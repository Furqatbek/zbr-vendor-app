/**
 * WebSocket client for real-time order & notification updates.
 *
 * Usage:
 *   const ws = createWSClient('wss://api.zbr.uz/ws');
 *   ws.connect(pushToken);
 *   ws.onMessage((event) => { ... });
 *   ws.disconnect();
 */

type WSMessage = {
  type: string;
  payload?: unknown;
};

type MessageHandler = (message: WSMessage) => void;

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000]; // exponential backoff, max ~16s

export function createWSClient(url: string) {
  let socket: WebSocket | null = null;
  let handlers: MessageHandler[] = [];
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let intentionalClose = false;
  let currentToken: string | null = null;

  function connect(pushToken?: string | null) {
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
    if (reconnectTimer) clearTimeout(reconnectTimer);
    const delay = RECONNECT_DELAYS[Math.min(reconnectAttempt, RECONNECT_DELAYS.length - 1)];
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
