import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
};

/**
 * Creates a new Redis connection instance.
 * Separate connections needed for: general commands, pub, sub
 * (Redis requires dedicated connections for subscribe mode)
 */
function createRedisClient(label = 'default') {
  const client = new Redis(REDIS_CONFIG);

  client.on('connect', () => {
    console.log(`[Redis:${label}] Connected to ${REDIS_CONFIG.host}:${REDIS_CONFIG.port}`);
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
