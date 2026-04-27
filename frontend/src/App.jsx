import { startTransition, useDeferredValue, useEffect, useRef, useState } from 'react'
import './App.css'
import { fetchConversation, fetchUsers, registerUser } from './api/chatApi'
import { createSocketClient } from './lib/socketClient'

const STORAGE_KEY = 'pulse-chat-user'
const TYPING_IDLE_MS = 1400
const SUGGESTED_USERS = ['alex', 'maya', 'noah']

function normalizeStoredUser(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const username = typeof value.username === 'string' ? value.username.trim() : ''
  if (!username) {
    return null
  }

  const displayName =
    typeof value.displayName === 'string' && value.displayName.trim()
      ? value.displayName.trim()
      : formatLabel(username)

  return {
    username,
    displayName,
    accentColor: typeof value.accentColor === 'string' ? value.accentColor : accentFromUsername(username),
  }
}

function readStoredUser() {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    if (!value) {
      return null
    }

    const normalizedValue = normalizeStoredUser(JSON.parse(value))
    if (!normalizedValue) {
      window.localStorage.removeItem(STORAGE_KEY)
    }

    return normalizedValue
  } catch {
    window.localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

function formatLabel(value = '') {
  return value
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function accentFromUsername(username = '') {
  const palette = ['#ff6b6b', '#f59e0b', '#10b981', '#0ea5e9', '#6366f1', '#ec4899']
  const hash = [...username].reduce((total, character) => total + character.charCodeAt(0), 0)
  return palette[hash % palette.length]
}

function buildFallbackUser(username, onlineSet) {
  return {
    username,
    displayName: formatLabel(username) || username,
    accentColor: accentFromUsername(username),
    online: onlineSet.has(username),
    lastSeenAt: null,
  }
}

function sortUsers(users, onlineSet) {
  return [...users].sort((left, right) => {
    const onlineDelta = Number(onlineSet.has(right.username)) - Number(onlineSet.has(left.username))
    if (onlineDelta !== 0) {
      return onlineDelta
    }

    return left.displayName.localeCompare(right.displayName)
  })
}

function ensureUser(users, username, onlineSet) {
  if (users.some((user) => user.username === username)) {
    return sortUsers(users, onlineSet)
  }

  return sortUsers([...users, buildFallbackUser(username, onlineSet)], onlineSet)
}

function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function formatMessageTime(timestamp) {
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

function formatLastSeen(user) {
  if (user.online) {
    return 'Online now'
  }

  if (!user.lastSeenAt) {
    return 'Seen recently'
  }

  return `Last seen ${new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
  }).format(new Date(user.lastSeenAt))}`
}

function previewConversation(messages, currentUsername) {
  if (!messages?.length) {
    return 'Start the conversation'
  }

  const latestMessage = messages[messages.length - 1]
  const prefix = latestMessage.sender === currentUsername ? 'You: ' : ''
  return `${prefix}${latestMessage.content}`
}

function App() {
  const [sessionUser, setSessionUser] = useState(() => readStoredUser())
  const [loginForm, setLoginForm] = useState(() => {
    const storedUser = readStoredUser()
    return {
      username: storedUser?.username ?? '',
      displayName: storedUser?.displayName ?? '',
    }
  })
  const [users, setUsers] = useState([])
  const [onlineUsers, setOnlineUsers] = useState([])
  const [conversations, setConversations] = useState({})
  const [typingUsers, setTypingUsers] = useState({})
  const [unreadCounts, setUnreadCounts] = useState({})
  const [drafts, setDrafts] = useState({})
  const [activeChat, setActiveChat] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearch = useDeferredValue(searchQuery)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [isLoadingConversation, setIsLoadingConversation] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const socketClientRef = useRef(null)
  const currentUserRef = useRef(sessionUser)
  const activeChatRef = useRef(activeChat)
  const onlineUsersRef = useRef(onlineUsers)
  const typingTimeoutRef = useRef(null)
  const typingStateRef = useRef(false)
  const typingExpiryRef = useRef({})
  const bottomMarkerRef = useRef(null)

  const onlineUserSet = new Set(onlineUsers)
  const activeMessages = activeChat ? conversations[activeChat] ?? [] : []
  const activeUser = activeChat
    ? users.find((user) => user.username === activeChat) ?? buildFallbackUser(activeChat, onlineUserSet)
    : null
  const activeDraft = activeChat ? drafts[activeChat] ?? '' : ''
  const filteredUsers = sortUsers(users, onlineUserSet).filter((user) => {
    const query = deferredSearch.trim().toLowerCase()
    if (!query) {
      return true
    }

    return (
      user.displayName.toLowerCase().includes(query) ||
      user.username.toLowerCase().includes(query)
    )
  })

  useEffect(() => {
    currentUserRef.current = sessionUser
    if (sessionUser) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionUser))
    } else {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  }, [sessionUser])

  useEffect(() => {
    activeChatRef.current = activeChat
  }, [activeChat])

  useEffect(() => {
    onlineUsersRef.current = onlineUsers
  }, [onlineUsers])

  useEffect(() => {
    return () => {
      clearTimeout(typingTimeoutRef.current)
      Object.values(typingExpiryRef.current).forEach((timeoutId) => window.clearTimeout(timeoutId))
    }
  }, [])

  useEffect(() => {
    bottomMarkerRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeChat, activeMessages.length, typingUsers[activeChat]])

  useEffect(() => {
    if (!sessionUser?.username) {
      return undefined
    }

    let cancelled = false

    const connectSocket = async () => {
      try {
        const client = await createSocketClient(sessionUser.username, {
        onConnect: () => {
          if (cancelled) {
            return
          }

          setIsConnected(true)
          setErrorMessage('')

          client.subscribe('/user/queue/messages', (frame) => {
            const payload = JSON.parse(frame.body)
            const currentUsername = currentUserRef.current?.username ?? ''
            const peer = payload.sender === currentUsername ? payload.recipient : payload.sender
            const currentOnlineSet = new Set(onlineUsersRef.current)

            setConversations((previousConversations) => {
              const existingMessages = previousConversations[peer] ?? []
              if (existingMessages.some((message) => message.id === payload.id)) {
                return previousConversations
              }

              return {
                ...previousConversations,
                [peer]: [...existingMessages, payload],
              }
            })

            setUsers((previousUsers) => ensureUser(previousUsers, peer, currentOnlineSet))

            if (payload.sender !== currentUsername && activeChatRef.current !== peer) {
              setUnreadCounts((previousCounts) => ({
                ...previousCounts,
                [peer]: (previousCounts[peer] ?? 0) + 1,
              }))
            }
          })

          client.subscribe('/user/queue/typing', (frame) => {
            const payload = JSON.parse(frame.body)

            setTypingUsers((previousTypingUsers) => ({
              ...previousTypingUsers,
              [payload.sender]: payload.typing,
            }))

            if (typingExpiryRef.current[payload.sender]) {
              window.clearTimeout(typingExpiryRef.current[payload.sender])
            }

            if (payload.typing) {
              typingExpiryRef.current[payload.sender] = window.setTimeout(() => {
                setTypingUsers((previousTypingUsers) => ({
                  ...previousTypingUsers,
                  [payload.sender]: false,
                }))
              }, TYPING_IDLE_MS + 300)
            }
          })

          client.subscribe('/topic/presence', (frame) => {
            const payload = JSON.parse(frame.body)
            const nextOnlineUsers = payload.onlineUsers ?? []
            const nextOnlineSet = new Set(nextOnlineUsers)

            setOnlineUsers(nextOnlineUsers)
            setUsers((previousUsers) =>
              sortUsers(
                previousUsers.map((user) => ({
                  ...user,
                  online: nextOnlineSet.has(user.username),
                })),
                nextOnlineSet,
              ),
            )
          })

          void refreshUsers()
        },
        onDisconnect: () => {
          if (!cancelled) {
            setIsConnected(false)
          }
        },
        onError: (message) => {
          if (!cancelled) {
            setIsConnected(false)
            setErrorMessage(message)
          }
        },
        })

        if (cancelled) {
          return
        }

        socketClientRef.current = client
        client.activate()
      } catch (error) {
        if (!cancelled) {
          setIsConnected(false)
          setErrorMessage(error instanceof Error ? error.message : 'Unable to start the chat socket client.')
        }
      }
    }

    void refreshUsers()
    void connectSocket()

    return () => {
      cancelled = true
      setIsConnected(false)
      socketClientRef.current?.deactivate()
      socketClientRef.current = null
    }
  }, [sessionUser?.username])

  async function refreshUsers() {
    if (!currentUserRef.current?.username) {
      return
    }

    setIsLoadingUsers(true)
    try {
      const nextUsers = await fetchUsers(currentUserRef.current.username)
      const currentOnlineSet = new Set(onlineUsersRef.current)
      const nextUsersWithPresence = nextUsers.map((user) => ({
        ...user,
        online: currentOnlineSet.has(user.username) || user.online,
      }))

      setUsers(sortUsers(nextUsersWithPresence, currentOnlineSet))

      if (!activeChatRef.current && nextUsersWithPresence.length > 0) {
        void openConversation(nextUsersWithPresence[0].username)
      }
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsLoadingUsers(false)
    }
  }

  function publishTyping(recipient, typing) {
    if (!recipient || !socketClientRef.current?.connected) {
      return
    }

    socketClientRef.current.publish({
      destination: '/app/chat.typing',
      body: JSON.stringify({ recipient, typing }),
    })
  }

  function stopTyping(recipient = activeChatRef.current) {
    window.clearTimeout(typingTimeoutRef.current)

    if (typingStateRef.current && recipient) {
      publishTyping(recipient, false)
    }

    typingStateRef.current = false
  }

  function scheduleTypingStop(recipient) {
    window.clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = window.setTimeout(() => {
      publishTyping(recipient, false)
      typingStateRef.current = false
    }, TYPING_IDLE_MS)
  }

  async function openConversation(username) {
    if (!username || !currentUserRef.current?.username) {
      return
    }

    if (activeChatRef.current && activeChatRef.current !== username) {
      stopTyping(activeChatRef.current)
    }

    startTransition(() => setActiveChat(username))
    setUnreadCounts((previousCounts) => ({
      ...previousCounts,
      [username]: 0,
    }))

    if (conversations[username]) {
      return
    }

    setIsLoadingConversation(true)
    try {
      const history = await fetchConversation(currentUserRef.current.username, username)
      setConversations((previousConversations) => ({
        ...previousConversations,
        [username]: history,
      }))
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsLoadingConversation(false)
    }
  }

  async function handleLogin(event) {
    event.preventDefault()
    setIsLoggingIn(true)
    setErrorMessage('')

    try {
      const registeredUser = await registerUser(loginForm)
      setUsers([])
      setOnlineUsers([])
      setConversations({})
      setTypingUsers({})
      setUnreadCounts({})
      setDrafts({})
      setActiveChat('')
      setSessionUser(registeredUser)
      setLoginForm({
        username: registeredUser.username,
        displayName: registeredUser.displayName,
      })
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsLoggingIn(false)
    }
  }

  function handleLogout() {
    stopTyping(activeChatRef.current)
    socketClientRef.current?.deactivate()
    setSessionUser(null)
    setUsers([])
    setOnlineUsers([])
    setConversations({})
    setTypingUsers({})
    setUnreadCounts({})
    setDrafts({})
    setActiveChat('')
    setSearchQuery('')
    setErrorMessage('')
    setLoginForm({ username: '', displayName: '' })
  }

  function handleDraftChange(event) {
    if (!activeChat) {
      return
    }

    const nextValue = event.target.value
    setDrafts((previousDrafts) => ({
      ...previousDrafts,
      [activeChat]: nextValue,
    }))

    if (!socketClientRef.current?.connected) {
      return
    }

    if (nextValue.trim()) {
      if (!typingStateRef.current) {
        publishTyping(activeChat, true)
        typingStateRef.current = true
      }
      scheduleTypingStop(activeChat)
      return
    }

    stopTyping(activeChat)
  }

  function handleSendMessage(event) {
    event.preventDefault()

    if (!activeChat || !activeDraft.trim() || !socketClientRef.current?.connected) {
      return
    }

    socketClientRef.current.publish({
      destination: '/app/chat.send',
      body: JSON.stringify({
        recipient: activeChat,
        content: activeDraft.trim(),
      }),
    })

    setDrafts((previousDrafts) => ({
      ...previousDrafts,
      [activeChat]: '',
    }))
    stopTyping(activeChat)
  }

  if (!sessionUser) {
    return (
      <div className="login-shell">
        <section className="intro-panel">
          <p className="eyebrow">React + Spring Boot + STOMP</p>
          <h1>PulseChat</h1>
          <p className="intro-copy">
            Real-time one-to-one messaging with live presence, typing indicators, and
            persistent conversation history.
          </p>
          <div className="feature-grid">
            <article className="feature-card">
              <span className="feature-number">01</span>
              <h2>Direct Messaging</h2>
              <p>Private chat streams powered by Spring WebSockets and STOMP routing.</p>
            </article>
            <article className="feature-card">
              <span className="feature-number">02</span>
              <h2>Typing Signals</h2>
              <p>Low-latency typing updates help conversations feel responsive and natural.</p>
            </article>
            <article className="feature-card">
              <span className="feature-number">03</span>
              <h2>Persistent History</h2>
              <p>Conversation records are stored on the backend and reloaded when users return.</p>
            </article>
          </div>
        </section>

        <section className="auth-panel">
          <form className="auth-card" onSubmit={handleLogin}>
            <div className="auth-heading">
              <p className="eyebrow">Join the workspace</p>
              <h2>Enter the chat</h2>
              <p>Use a short username, then open a second tab with another user to test live messaging.</p>
            </div>

            <label className="field">
              <span>Username</span>
              <input
                name="username"
                placeholder="alex"
                value={loginForm.username}
                onChange={(event) =>
                  setLoginForm((previousForm) => ({
                    ...previousForm,
                    username: event.target.value,
                  }))
                }
                required
              />
            </label>

            <label className="field">
              <span>Display name</span>
              <input
                name="displayName"
                placeholder="Alex Carter"
                value={loginForm.displayName}
                onChange={(event) =>
                  setLoginForm((previousForm) => ({
                    ...previousForm,
                    displayName: event.target.value,
                  }))
                }
              />
            </label>

            <div className="suggestion-row">
              <span>Quick test users</span>
              <div className="chip-row">
                {SUGGESTED_USERS.map((suggestedUser) => (
                  <button
                    key={suggestedUser}
                    type="button"
                    className="chip"
                    onClick={() =>
                      setLoginForm({
                        username: suggestedUser,
                        displayName: formatLabel(suggestedUser),
                      })
                    }
                  >
                    {suggestedUser}
                  </button>
                ))}
              </div>
            </div>

            {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}

            <button className="primary-button" type="submit" disabled={isLoggingIn}>
              {isLoggingIn ? 'Entering…' : 'Enter chat'}
            </button>
          </form>
        </section>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <section className="sidebar-card brand-card">
          <div>
            <p className="eyebrow">PulseChat</p>
            <h2>Live conversations</h2>
          </div>
          <div className="metric-row">
            <article className="metric-pill">
              <strong>{users.length}</strong>
              <span>contacts</span>
            </article>
            <article className="metric-pill">
              <strong>{onlineUsers.length}</strong>
              <span>online</span>
            </article>
          </div>
        </section>

        <section className="sidebar-card session-card">
          <div className="session-summary">
            <div
              className="avatar avatar-large"
              style={{ '--avatar-accent': sessionUser.accentColor ?? accentFromUsername(sessionUser.username) }}
            >
              {getInitials(sessionUser.displayName ?? sessionUser.username)}
            </div>
            <div>
              <h3>{sessionUser.displayName ?? formatLabel(sessionUser.username)}</h3>
              <p>@{sessionUser.username}</p>
            </div>
          </div>

          <div className="status-row">
            <span className={`connection-badge ${isConnected ? 'is-live' : 'is-quiet'}`}>
              {isConnected ? 'Live' : 'Reconnecting'}
            </span>
            <button type="button" className="ghost-button" onClick={handleLogout}>
              Switch user
            </button>
          </div>
        </section>

        <section className="sidebar-card search-card">
          <label className="field field-compact">
            <span>Find a teammate</span>
            <input
              placeholder="Search by name or username"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>
        </section>

        {errorMessage ? <p className="error-banner sidebar-error">{errorMessage}</p> : null}

        <section className="user-list">
          {isLoadingUsers ? <p className="section-note">Loading contacts…</p> : null}

          {!isLoadingUsers && filteredUsers.length === 0 ? (
            <div className="empty-card">
              <h3>No contacts yet</h3>
              <p>Open another tab with a different username to test the one-to-one chat flow.</p>
              <button type="button" className="secondary-button" onClick={() => void refreshUsers()}>
                Refresh list
              </button>
            </div>
          ) : null}

          {filteredUsers.map((user) => {
            const latestPreview = previewConversation(conversations[user.username], sessionUser.username)
            const isActive = user.username === activeChat
            const unreadCount = unreadCounts[user.username] ?? 0

            return (
              <button
                key={user.username}
                type="button"
                className={`user-card ${isActive ? 'is-active' : ''}`}
                onClick={() => void openConversation(user.username)}
                style={{ '--card-accent': user.accentColor }}
              >
                <div className="avatar" style={{ '--avatar-accent': user.accentColor }}>
                  {getInitials(user.displayName)}
                </div>
                <div className="user-copy">
                  <div className="user-title-row">
                    <strong>{user.displayName}</strong>
                    {unreadCount > 0 ? <span className="unread-dot">{unreadCount}</span> : null}
                  </div>
                  <p>@{user.username}</p>
                  <small>{latestPreview}</small>
                </div>
                <span className={`presence-dot ${user.online ? 'is-online' : ''}`} />
              </button>
            )
          })}
        </section>
      </aside>

      <main className="chat-panel">
        {!activeUser ? (
          <section className="empty-chat">
            <p className="eyebrow">Start chatting</p>
            <h2>Choose a contact from the left panel</h2>
            <p>
              If you are testing alone, open this app in another tab and sign in with a different username.
            </p>
          </section>
        ) : (
          <>
            <header className="chat-header">
              <div className="chat-header-left">
                <div className="avatar avatar-large" style={{ '--avatar-accent': activeUser.accentColor }}>
                  {getInitials(activeUser.displayName)}
                </div>
                <div>
                  <h2>{activeUser.displayName}</h2>
                  <p>{formatLastSeen(activeUser)}</p>
                </div>
              </div>
              <div className="chat-header-right">
                <span className={`connection-badge ${isConnected ? 'is-live' : 'is-quiet'}`}>
                  {isConnected ? 'Socket connected' : 'Socket reconnecting'}
                </span>
                <button type="button" className="secondary-button" onClick={() => void refreshUsers()}>
                  Refresh users
                </button>
              </div>
            </header>

            <section className="message-stream">
              {isLoadingConversation ? <p className="section-note">Loading conversation…</p> : null}

              {!isLoadingConversation && activeMessages.length === 0 ? (
                <div className="empty-card chat-empty-card">
                  <h3>No messages yet</h3>
                  <p>Say hello to kick off the conversation.</p>
                </div>
              ) : null}

              {activeMessages.map((message) => {
                const isOwnMessage = message.sender === sessionUser.username
                return (
                  <article
                    key={message.id}
                    className={`message-bubble ${isOwnMessage ? 'is-own-message' : ''}`}
                  >
                    <p>{message.content}</p>
                    <span>{formatMessageTime(message.sentAt)}</span>
                  </article>
                )
              })}

              {typingUsers[activeChat] ? (
                <div className="typing-row">
                  <span>{activeUser.displayName} is typing</span>
                  <div className="typing-dots" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              ) : null}

              <div ref={bottomMarkerRef} />
            </section>

            <form className="composer" onSubmit={handleSendMessage}>
              <textarea
                placeholder={`Message ${activeUser.displayName}...`}
                value={activeDraft}
                onChange={handleDraftChange}
                rows={1}
              />
              <button type="submit" className="primary-button" disabled={!isConnected || !activeDraft.trim()}>
                Send
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  )
}

export default App
