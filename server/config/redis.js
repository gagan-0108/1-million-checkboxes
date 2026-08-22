import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Build Redis connection config.
 * Supports REDIS_URL (used by Render, Railway, and most cloud providers)
 * or falls back to separate REDIS_HOST + REDIS_PORT (for local / docker-compose).
 */
function getRedisConfig() {
  const retryStrategy = (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  };

  // If REDIS_URL is provided, use it directly (supports redis:// and rediss:// for TLS)
  if (process.env.REDIS_URL) {
    return {
      url: process.env.REDIS_URL,
      retryStrategy,
      maxRetriesPerRequest: 3,
      // Enable TLS for rediss:// URLs (managed Redis services)
      ...(process.env.REDIS_URL.startsWith('rediss://') && {
        tls: { rejectUnauthorized: false },
      }),
    };
  }

  // Fallback to separate host/port
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    retryStrategy,
    maxRetriesPerRequest: 3,
  };
}

/**
 * Creates a new Redis connection instance.
 * Separate connections needed for: general commands, pub, sub
 * (Redis requires dedicated connections for subscribe mode)
 */
function createRedisClient(label = 'default') {
  const config = getRedisConfig();

  // ioredis accepts a URL string as the first argument
  const client = config.url
    ? new Redis(config.url, {
        retryStrategy: config.retryStrategy,
        maxRetriesPerRequest: config.maxRetriesPerRequest,
        ...(config.tls ? { tls: config.tls } : {}),
      })
    : new Redis(config);

  client.on('connect', () => {
    const target = config.url
      ? config.url.replace(/\/\/.*@/, '//***@') // hide credentials in logs
      : `${config.host}:${config.port}`;
    console.log(`[Redis:${label}] Connected to ${target}`);
  });

  client.on('error', (err) => {
    console.error(`[Redis:${label}] Error:`, err.message);
  });

  client.on('close', () => {
    console.log(`[Redis:${label}] Connection closed`);
  });

  return client;
}

// Main client for general commands (GET, SET, SETBIT, etc.)
export const redis = createRedisClient('main');

// Publisher client for Pub/Sub publishing
export const publisher = createRedisClient('publisher');

// Subscriber client for Pub/Sub subscriptions
// This connection enters subscriber mode and can't do regular commands
export const subscriber = createRedisClient('subscriber');

/**
 * Graceful shutdown — close all Redis connections
 */
export async function closeRedisConnections() {
  await Promise.all([
    redis.quit(),
    publisher.quit(),
    subscriber.quit(),
  ]);
  console.log('[Redis] All connections closed');
}

export default { redis, publisher, subscriber, closeRedisConnections };
