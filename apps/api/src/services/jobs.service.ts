import { orderedSteps } from "@image-pipeline/core";
import { Prisma, type JobStatus, type StepStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { mediaQueue } from "../lib/queue.js";
import { putObject } from "../lib/storage.js";
import { sha256 } from "../lib/hash.js";

function getQueueJobOptions(maxAttempts: number) {
  return {
    attempts: maxAttempts,
    backoff: {
      type: "exponential" as const,
      delay: 2_000
    },
    removeOnComplete: 100,
    removeOnFail: 100
  };
}

export async function createJobForUpload(params: {
  userId: string;
  file: Express.Multer.File;
}) {
  const checksum = sha256(params.file.buffer);
  const key = `${params.userId}/${checksum}-${Date.now()}-${params.file.originalname}`;
  const storage = await putObject(key, params.file.buffer, params.file.mimetype);

  const job = await prisma.$transaction(async (tx) => {
    const created = await tx.mediaJob.create({
      data: {
        userId: params.userId,
        originalFilename: params.file.originalname,
        mimeType: params.file.mimetype,
        sizeBytes: params.file.size,
        sha256: checksum,
        storageProvider: storage.storageProvider,
        storageBucket: storage.storageBucket,
        storageKey: storage.storageKey,
        status: "PENDING",
        queuedAt: new Date()
      }
    });

    await tx.jobStep.createMany({
      data: orderedSteps.map((step) => ({
        jobId: created.id,
        name: step.name,
        position: step.position,
        status: "PENDING"
      }))
    });

    await tx.jobEvent.createMany({
      data: [
        { jobId: created.id, type: "JOB_CREATED" },
        { jobId: created.id, type: "JOB_QUEUED" }
      ]
    });

    return created;
  });

  await mediaQueue.add(
    "process-media",
    { jobId: job.id },
    getQueueJobOptions(job.maxAttempts)
  );

  return {
    jobId: job.id,
    status: job.status
  };
}

export async function listJobsForUser(userId: string) {
  const jobs = await prisma.mediaJob.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      steps: {
        orderBy: { position: "asc" }
      },
      events: {
        orderBy: { createdAt: "asc" }
      }
    }
  });

  return jobs;
}

export async function getJobForUser(userId: string, jobId: string) {
  return prisma.mediaJob.findFirst({
    where: {
      id: jobId,
      userId
    },
    include: {
      steps: {
        orderBy: { position: "asc" }
      },
      events: {
        orderBy: { createdAt: "asc" }
      }
    }
  });
}

export async function retryJobForUser(userId: string, jobId: string) {
  const job = await prisma.mediaJob.findFirst({
    where: { id: jobId, userId },
    include: { steps: true }
  });

  if (!job) {
    return null;
  }

  if (job.status !== "FAILED") {
    throw new Error("Only FAILED jobs can be retried");
  }

  await prisma.$transaction(async (tx) => {
    await tx.mediaJob.update({
      where: { id: job.id },
      data: {
        status: "PENDING",
        attempts: 0,
        lastError: Prisma.DbNull,
        failedAt: null,
        queuedAt: new Date()
      }
    });

    for (const step of job.steps) {
      if (step.status === "FAILED") {
        await tx.jobStep.update({
          where: { id: step.id },
          data: {
            status: "PENDING",
            errorJson: Prisma.DbNull,
            startedAt: null,
            completedAt: null
          }
        });
      }
    }

    await tx.jobEvent.create({
      data: {
        jobId: job.id,
        type: "JOB_RETRIED"
      }
    });
  });

  await mediaQueue.add(
    "process-media",
    { jobId: job.id },
    getQueueJobOptions(job.maxAttempts)
  );

  return {
    jobId: job.id,
    status: "PENDING" as JobStatus
  };
}

export function deriveCurrentStage(steps: Array<{ name: string; status: StepStatus }>) {
  const current = steps.find((step) => step.status === "PROCESSING" || step.status === "FAILED");

  if (current) {
    return current.name;
  }

  const next = steps.find((step) => step.status === "PENDING");
  return next?.name ?? "COMPLETE";
}
