import { redis } from '../config/redis.js';

/**
 * Custom Sliding Window Rate Limiter using Redis Sorted Sets.
 *
 * How it works:
 * - Each request adds a member to a sorted set keyed by identifier
 * - The member score is the current timestamp
 * - Before checking, we remove all entries outside the window
 * - Count remaining entries — if >= maxRequests, reject
 *
 * This approach is accurate (no boundary issues like fixed windows)
 * and uses Redis for state (works across multiple server instances).
 *
 * No external rate-limit packages are used.
 */

/**
 * Creates a rate limiter middleware for Express routes.
 * @param {Object} options
 * @param {number} options.windowMs - Time window in milliseconds (default: 60000)
 * @param {number} options.maxRequests - Max requests per window (default: 100)
 * @param {string} options.keyPrefix - Redis key prefix (default: 'rl:http')
 * @returns {Function} Express middleware
 */
export function createHttpRateLimiter({
  windowMs = 60 * 1000,
  maxRequests = 100,
  keyPrefix = 'rl:http',
} = {}) {
  return async (req, res, next) => {
    try {
      // Identify the requester: use userId if authenticated, else IP
      const identifier = req.user?.id || req.ip || req.connection.remoteAddress;
      const key = `${keyPrefix}:${identifier}`;
      const now = Date.now();
      const windowStart = now - windowMs;

      // Pipeline: remove old entries, add current, count
      const pipeline = redis.pipeline();
      pipeline.zremrangebyscore(key, 0, windowStart);      // Remove expired
      pipeline.zadd(key, now, `${now}:${Math.random()}`);  // Add this request
      pipeline.zcard(key);                                  // Count in window
      pipeline.expire(key, Math.ceil(windowMs / 1000) + 1); // Auto-cleanup

      const results = await pipeline.exec();
      const requestCount = results[2][1]; // zcard result

      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': Math.max(0, maxRequests - requestCount).toString(),
        'X-RateLimit-Reset': new Date(now + windowMs).toISOString(),
      });

      if (requestCount > maxRequests) {
        return res.status(429).json({
          error: 'Too many requests',
          message: `Rate limit exceeded. Max ${maxRequests} requests per ${windowMs / 1000}s window.`,
          retryAfter: Math.ceil(windowMs / 1000),
        });
      }

      next();
    } catch (err) {
      console.error('[RateLimiter] Error:', err.message);
      // Fail open — don't block requests if Redis is down
      next();
    }
  };
}

/**
 * Check rate limit for a WebSocket event.
 * Returns { allowed: boolean, remaining: number, retryAfter: number }
 *
 * @param {string} identifier - User ID, socket ID, or IP
 * @param {Object} options
 * @param {number} options.windowMs - Time window in milliseconds (default: 10000)
 * @param {number} options.maxRequests - Max events per window (default: 20)
 * @param {string} options.keyPrefix - Redis key prefix (default: 'rl:ws')
 * @returns {Promise<{allowed: boolean, remaining: number, retryAfter: number}>}
 */
export async function checkSocketRateLimit(identifier, {
  windowMs = 10 * 1000,
  maxRequests = 20,
  keyPrefix = 'rl:ws',
} = {}) {
  try {
    const key = `${keyPrefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zadd(key, now, `${now}:${Math.random()}`);
    pipeline.zcard(key);
    pipeline.expire(key, Math.ceil(windowMs / 1000) + 1);

    const results = await pipeline.exec();
    const requestCount = results[2][1];

    return {
      allowed: requestCount <= maxRequests,
      remaining: Math.max(0, maxRequests - requestCount),
      retryAfter: Math.ceil(windowMs / 1000),
    };
  } catch (err) {
    console.error('[RateLimiter:Socket] Error:', err.message);
    // Fail open
    return { allowed: true, remaining: 0, retryAfter: 0 };
  }
}

export default { createHttpRateLimiter, checkSocketRateLimit };
