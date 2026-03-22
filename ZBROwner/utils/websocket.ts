/**
 * WebSocket client for real-time order & notification updates.
 *
 * Usage:
 *   const ws = createWSClient(ENDPOINTS.ws);
 *   ws.connect(pushToken);
 *   ws.onMessage((event) => { ... });
 *   ws.disconnect();
 */

type WSMessage = {
  type: string;
  payload?: unknown;
};

type MessageHandler = (message: WSMessage) => void;

const MAX_RETRIES = 3;
const RECONNECT_DELAYS = [1000, 2000, 4000]; // exponential backoff

export function createWSClient(url: string) {
  let socket: WebSocket | null = null;
  let handlers: MessageHandler[] = [];
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let intentionalClose = false;
  let currentToken: string | null = null;

  function connect(pushToken?: string | null) {
    if (!url) return; // no WS endpoint configured
    intentionalClose = false;
    currentToken = pushToken ?? null;

    const wsUrl = currentToken ? `${url}?token=${encodeURIComponent(currentToken)}` : url;
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      reconnectAttempt = 0;
    };

    socket.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        handlers.forEach((handler) => handler(message));
      } catch {
        // ignore malformed messages
      }
    };

    socket.onclose = () => {
      if (!intentionalClose) {
        scheduleReconnect();
      }
    };

    socket.onerror = () => {
      // onclose will fire after onerror, triggering reconnect
    };
  }

  function scheduleReconnect() {
    if (reconnectAttempt >= MAX_RETRIES) return;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    const delay = RECONNECT_DELAYS[reconnectAttempt] ?? RECONNECT_DELAYS[RECONNECT_DELAYS.length - 1];
    reconnectTimer = setTimeout(() => {
      reconnectAttempt++;
      connect(currentToken);
    }, delay);
  }

  function disconnect() {
    intentionalClose = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (socket) {
      socket.close();
      socket = null;
    }
  }

  function send(message: WSMessage) {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  function onMessage(handler: MessageHandler) {
    handlers.push(handler);
    return () => {
      handlers = handlers.filter((h) => h !== handler);
    };
  }

  return { connect, disconnect, send, onMessage };
}
