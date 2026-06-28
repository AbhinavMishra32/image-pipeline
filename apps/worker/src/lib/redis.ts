import { Redis } from "ioredis";
import { config } from "../config.js";
import { createBullmqConnection } from "./redis-options.js";

export { createBullmqConnection };

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
  lazyConnect: true
});

export const bullmqConnection = createBullmqConnection(config.redisUrl);
