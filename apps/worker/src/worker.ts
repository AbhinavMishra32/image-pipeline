import { Worker } from "bullmq";
import {
  OpenRouterVisionProvider,
  mediaQueueName,
  processMediaJob
} from "@image-pipeline/core";
import { config } from "./config.js";
import { bullmqConnection } from "./lib/redis.js";
import { prisma } from "./lib/prisma.js";
import { storage } from "./lib/storage.js";
import { prismaPipelineStore } from "./prisma-pipeline-store.js";
import { serializeError } from "@image-pipeline/core";

function log(level: "info" | "error", event: string, context: Record<string, unknown>) {
  const entry = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...context
  };

  if (level === "error") {
    console.error(JSON.stringify(entry, null, 2));
    return;
  }

  console.log(JSON.stringify(entry, null, 2));
}

function createProvider() {
  if (!config.openRouterApiKey) {
    throw new Error("OPENROUTER_API_KEY is required to process media jobs");
  }

  return new OpenRouterVisionProvider({
    apiKey: config.openRouterApiKey,
    captionModel: config.openRouterCaptionModel,
    labelModel: config.openRouterLabelModel,
    safetyModel: config.openRouterSafetyModel,
    appName: "image-pipeline"
  });
}

const worker = new Worker<{ jobId: string }, { status: "COMPLETED" | "FLAGGED" }, "process-media">(
  mediaQueueName,
  async (bullJob) => {
    log("info", "worker.job.started", {
      bullJobId: bullJob.id,
      jobId: bullJob.data.jobId,
      attempt: bullJob.attemptsMade + 1
    });

    const job = await prisma.mediaJob.findUnique({
      where: { id: bullJob.data.jobId }
    });

    if (!job) {
      throw new Error(`MediaJob ${bullJob.data.jobId} not found`);
    }

    let provider: OpenRouterVisionProvider;

    try {
      provider = createProvider();
    } catch (error) {
      const errorJson = serializeError(error);
      await prismaPipelineStore.markJobFailed(job.id, errorJson);
      await prismaPipelineStore.createEvent(job.id, "JOB_FAILED", { error: errorJson });
      throw error;
    }

    return processMediaJob(
      prismaPipelineStore,
      storage,
      provider,
      job.id,
      {
        bucket: job.storageBucket,
        key: job.storageKey
      },
      {
        finalizeFailure: (bullJob.attemptsMade + 1) >= job.maxAttempts
      }
    );
  },
  {
    connection: bullmqConnection,
    concurrency: 2
  }
);

worker.on("failed", (job, error) => {
  const serializedError = serializeError(error);

  log("error", "worker.job.failed", {
    bullJobId: job?.id,
    jobId: job?.data.jobId,
    queueName: job?.queueName,
    attemptsMade: job?.attemptsMade,
    serializedError
  });
});

worker.on("completed", (job, result) => {
  log("info", "worker.job.completed", {
    bullJobId: job.id,
    jobId: job.data.jobId,
    queueName: job.queueName,
    result
  });
});

process.on("SIGINT", async () => {
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});
