import { createAdapter } from '@socket.io/redis-adapter';
import { publisher, subscriber } from '../config/redis.js';
import { socketAuthMiddleware } from '../auth/authMiddleware.js';
import { setCheckbox, getStats } from '../services/checkboxService.js';
import { checkSocketRateLimit } from '../middleware/rateLimiter.js';

// Track connected users
const connectedUsers = new Map();

/**
 * Initialize Socket.io with Redis adapter and event handlers.
 * @param {import('socket.io').Server} io - Socket.io server instance
 */
export function initializeSocket(io) {
  // Use Redis adapter for multi-server Pub/Sub
  io.adapter(createAdapter(publisher, subscriber));

  // Apply authentication middleware
  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    const userId = socket.data.user?.id || socket.id;
    const userName = socket.data.user?.name || 'Anonymous';
    const isAuth = socket.data.authenticated;

    console.log(`[Socket] Connected: ${userName} (${socket.id}) | Auth: ${isAuth}`);

    // Track connection
    connectedUsers.set(socket.id, {
      id: userId,
      name: userName,
      authenticated: isAuth,
      connectedAt: Date.now(),
    });

    // Broadcast updated user count
    broadcastOnlineCount(io);

    // ── Event: checkbox:toggle ──
    socket.on('checkbox:toggle', async (data) => {
      try {
        const { index, checked } = data;

        // Validate input
        if (typeof index !== 'number' || typeof checked !== 'boolean') {
          socket.emit('error:message', {
            error: 'Invalid data format. Expected { index: number, checked: boolean }',
          });
          return;
        }

        if (index < 0 || index >= 1000000) {
          socket.emit('error:message', {
            error: `Checkbox index ${index} out of range [0, 1000000)`,
          });
          return;
        }

        // Require authentication to toggle
        if (!socket.data.authenticated) {
          socket.emit('error:message', {
            error: 'Authentication required. Please log in to toggle checkboxes.',
          });
          return;
        }

        // Rate limit check
        const rateLimit = await checkSocketRateLimit(userId, {
          windowMs: 10 * 1000,   // 10-second window
          maxRequests: 15,        // Max 15 toggles per 10 seconds
          keyPrefix: 'rl:ws',
        });

        if (!rateLimit.allowed) {
          socket.emit('error:message', {
            error: `Rate limit exceeded. Please wait before toggling more checkboxes.`,
            retryAfter: rateLimit.retryAfter,
          });
          return;
        }

        // Update state in Redis bitmap
        await setCheckbox(index, checked);

        // Broadcast to ALL connected clients (including sender)
        // The Redis adapter handles cross-server broadcasting
        io.emit('checkbox:update', { index, checked, userId });

      } catch (err) {
        console.error(`[Socket] Error handling toggle:`, err.message);
        socket.emit('error:message', { error: 'Server error processing toggle' });
      }
    });

    // ── Event: stats:request ──
    socket.on('stats:request', async () => {
      try {
        const stats = await getStats();
        socket.emit('stats:update', {
          ...stats,
          onlineUsers: connectedUsers.size,
        });
      } catch (err) {
        console.error('[Socket] Error fetching stats:', err.message);
      }
    });

    // ── Event: disconnect ──
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected: ${userName} (${socket.id}) | Reason: ${reason}`);
      connectedUsers.delete(socket.id);
      broadcastOnlineCount(io);
    });
  });

  console.log('[Socket] Initialized with Redis adapter');
}

/**
 * Broadcast the current online user count to all clients.
 */
function broadcastOnlineCount(io) {
  io.emit('users:count', { count: connectedUsers.size });
}

/**
 * Get the current connected users count.
 */
export function getOnlineCount() {
  return connectedUsers.size;
}

export default { initializeSocket, getOnlineCount };
