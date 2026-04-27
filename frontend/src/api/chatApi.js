const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
  })

  if (!response.ok) {
    let message = 'Something went wrong while contacting the chat server.'

    try {
      const payload = await response.json()
      message = payload.detail ?? payload.message ?? payload.error ?? message
    } catch {
      // Ignore JSON parsing failures and fall back to the default message.
    }

    throw new Error(message)
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

export function registerUser(payload) {
  return request('/api/users/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchUsers(currentUser) {
  const query = new URLSearchParams({ currentUser })
  return request(`/api/users?${query.toString()}`)
}

export function fetchConversation(currentUser, otherUser) {
  const encodedCurrentUser = encodeURIComponent(currentUser)
  const encodedOtherUser = encodeURIComponent(otherUser)
  return request(`/api/conversations/${encodedCurrentUser}/${encodedOtherUser}`)
}
