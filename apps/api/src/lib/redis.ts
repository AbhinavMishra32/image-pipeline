import { Redis } from "ioredis";
import { config } from "../config.js";

export function createBullmqConnection(redisUrlString: string) {
  const redisUrl = new URL(redisUrlString);

  return {
    host: redisUrl.hostname,
    port: Number(redisUrl.port || 6379),
    username: redisUrl.username || undefined,
    password: redisUrl.password || undefined,
    db: redisUrl.pathname ? Number(redisUrl.pathname.slice(1) || 0) : 0,
    maxRetriesPerRequest: null
  };
}

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
  lazyConnect: true
});

export const bullmqConnection = createBullmqConnection(config.redisUrl);
