import Redis from 'ioredis';
import config from '../config.js';

let redis;

const MENU_CACHE_KEY = `${config.cache.keyPrefix}menu:full`;

export async function initRedis() {
  redis = new Redis(config.redis.url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    enableReadyCheck: true,
  });

  await redis.connect();
  console.log('Redis connected');
}

export async function getCachedMenu() {
  if (!redis) return null;
  const data = await redis.get(MENU_CACHE_KEY);
  return data ? JSON.parse(data) : null;
}

export async function setMenuCache(menu) {
  if (!redis) return;
  await redis.set(MENU_CACHE_KEY, JSON.stringify(menu), 'EX', config.cache.menuTTL);
}

export async function invalidateMenuCache() {
  if (!redis) return;
  await redis.del(MENU_CACHE_KEY);
}

export { redis };
