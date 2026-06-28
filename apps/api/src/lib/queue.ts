import { Queue } from "bullmq";
import { mediaQueueName } from "@image-pipeline/core";
import { bullmqConnection } from "./redis.js";

export const mediaQueue = new Queue<{ jobId: string }, unknown, "process-media">(mediaQueueName, {
  connection: bullmqConnection
});
