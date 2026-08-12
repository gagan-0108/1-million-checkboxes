/**
 * Socket.io Client Module
 * Handles WebSocket connection, authentication, and real-time events.
 */

let socket = null;
let onUpdateCallback = null;
let onErrorCallback = null;
let onStatsCallback = null;
let onUsersCallback = null;
let onConnectCallback = null;
let onDisconnectCallback = null;

/**
 * Initialize the Socket.io connection.
 * @param {Object} options
 * @param {string} options.token - JWT token for authentication (optional)
 * @param {Function} options.onUpdate - Called when a checkbox update is received
 * @param {Function} options.onError - Called when an error occurs
 * @param {Function} options.onStats - Called when stats are received
 * @param {Function} options.onUsers - Called when user count changes
 * @param {Function} options.onConnect - Called when connected
 * @param {Function} options.onDisconnect - Called when disconnected
 */
export function initSocket({
  token = null,
  onUpdate = null,
  onError = null,
  onStats = null,
  onUsers = null,
  onConnect = null,
  onDisconnect = null,
} = {}) {
  // Store callbacks
  onUpdateCallback = onUpdate;
  onErrorCallback = onError;
  onStatsCallback = onStats;
  onUsersCallback = onUsers;
  onConnectCallback = onConnect;
  onDisconnectCallback = onDisconnect;

  // Build auth options
  const authOptions = {};
  if (token) {
    authOptions.auth = { token };
  }

  // Connect
  socket = io({
    ...authOptions,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
    timeout: 20000,
  });

  // ── Connection events ──
  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id);
    onConnectCallback?.();
    // Request initial stats
    requestStats();
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
    onDisconnectCallback?.(reason);
  });

  socket.on('connect_error', (error) => {
    console.error('[Socket] Connection error:', error.message);
  });

  // ── Application events ──
  socket.on('checkbox:update', (data) => {
    onUpdateCallback?.(data);
  });

  socket.on('error:message', (data) => {
    console.warn('[Socket] Error:', data.error);
    onErrorCallback?.(data);
  });

  socket.on('stats:update', (data) => {
    onStatsCallback?.(data);
  });

  socket.on('users:count', (data) => {
    onUsersCallback?.(data);
  });

  return socket;
}

/**
 * Emit a checkbox toggle event.
 * @param {number} index - Checkbox index
 * @param {boolean} checked - New state
 */
export function emitToggle(index, checked) {
  if (!socket || !socket.connected) {
    onErrorCallback?.({ error: 'Not connected to server' });
    return;
  }
  socket.emit('checkbox:toggle', { index, checked });
}

/**
 * Request current statistics from the server.
 */
export function requestStats() {
  if (socket && socket.connected) {
    socket.emit('stats:request');
  }
}

/**
 * Reconnect with a new token (after login).
 * @param {string} token - New JWT token
 */
export function reconnectWithAuth(token) {
  if (socket) {
    socket.auth = { token };
    socket.disconnect().connect();
  }
}

/**
 * Disconnect the socket.
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
  }
}

/**
 * Check if currently connected.
 */
export function isConnected() {
  return socket?.connected ?? false;
}

export default {
  initSocket,
  emitToggle,
  requestStats,
  reconnectWithAuth,
  disconnectSocket,
  isConnected,
};
