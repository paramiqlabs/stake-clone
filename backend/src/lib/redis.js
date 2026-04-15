const dotenv = require("dotenv");
const Redis = require("ioredis");

dotenv.config();

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const createInMemoryRedis = () => {
  const store = new Map();
  const expirations = new Map();

  const isExpired = (key) => {
    const expiresAt = expirations.get(key);
    if (typeof expiresAt !== "number") {
      return false;
    }

    if (Date.now() >= expiresAt) {
      store.delete(key);
      expirations.delete(key);
      return true;
    }

    return false;
  };

  const clearIfExpired = (key) => {
    isExpired(key);
  };

  return {
    async get(key) {
      clearIfExpired(key);
      return store.has(key) ? store.get(key) : null;
    },
    async set(key, value, mode, ttlSeconds) {
      store.set(key, String(value));
      if (String(mode).toUpperCase() === "EX") {
        const ttl = toNumber(ttlSeconds);
        if (ttl && ttl > 0) {
          expirations.set(key, Date.now() + ttl * 1000);
        }
      } else {
        expirations.delete(key);
      }

      return "OK";
    },
    async del(...keys) {
      let removed = 0;
      keys.forEach((key) => {
        clearIfExpired(key);
        if (store.delete(key)) {
          removed += 1;
        }
        expirations.delete(key);
      });
      return removed;
    },
    async sadd(key, value) {
      clearIfExpired(key);
      const current = store.get(key);
      const set = current instanceof Set ? current : new Set();
      const before = set.size;
      set.add(String(value));
      store.set(key, set);
      return set.size > before ? 1 : 0;
    },
    async srem(key, value) {
      clearIfExpired(key);
      const current = store.get(key);
      if (!(current instanceof Set)) {
        return 0;
      }

      const removed = current.delete(String(value));
      if (current.size === 0) {
        store.delete(key);
      }

      return removed ? 1 : 0;
    },
    async scard(key) {
      clearIfExpired(key);
      const current = store.get(key);
      return current instanceof Set ? current.size : 0;
    },
  };
};

const redisUrl = process.env.REDIS_URL;
const redisDisabled = String(process.env.REDIS_DISABLED || "").toLowerCase() === "true";

if (!redisUrl || redisDisabled) {
  console.warn("[redis] disabled; using in-memory fallback");
  module.exports = createInMemoryRedis();
  return;
}

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  retryStrategy: () => null,
});

redis.on("error", (error) => {
  console.error("[redis] error:", error.message);
});

module.exports = redis;
