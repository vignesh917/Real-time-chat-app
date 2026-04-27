const SOCKET_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:8080/ws-chat'

export async function createSocketClient(username, { onConnect, onDisconnect, onError }) {
  const [{ Client }, { default: SockJS }] = await Promise.all([
    import('@stomp/stompjs'),
    import('sockjs-client'),
  ])

  return new Client({
    reconnectDelay: 3000,
    debug: () => {},
    connectHeaders: {
      'x-user': username,
    },
    webSocketFactory: () => new SockJS(SOCKET_URL),
    onConnect,
    onDisconnect,
    onStompError: (frame) => {
      onError?.(frame.headers.message ?? 'The WebSocket broker rejected the request.')
    },
    onWebSocketClose: () => {
      onDisconnect?.()
    },
    onWebSocketError: () => {
      onError?.('The real-time connection dropped. Trying again now.')
    },
  })
}
