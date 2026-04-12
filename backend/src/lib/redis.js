const dotenv = require("dotenv");
const Redis = require("ioredis");

dotenv.config();

const redis = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
});

redis.on("error", (error) => {
  console.error("[redis] error:", error.message);
});

module.exports = redis;
