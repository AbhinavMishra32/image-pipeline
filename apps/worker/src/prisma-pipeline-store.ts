import { Prisma } from "@prisma/client";
import type { PipelineStore } from "@image-pipeline/core";
import { prisma } from "./lib/prisma.js";

export const prismaPipelineStore: PipelineStore = {
  async getJob(jobId) {
    return prisma.mediaJob.findUnique({
      where: { id: jobId }
    });
  },
  async getStep(jobId, stepName) {
    return prisma.jobStep.findUnique({
      where: {
        jobId_name: {
          jobId,
          name: stepName
        }
      }
    });
  },
  async listSteps(jobId) {
    return prisma.jobStep.findMany({
      where: { jobId },
      orderBy: { position: "asc" }
    });
  },
  async createEvent(jobId, type, payload) {
    await prisma.jobEvent.create({
      data: {
        jobId,
        type: type as never,
        payloadJson: payload as never
      }
    });
  },
  async markJobProcessing(jobId) {
    await prisma.mediaJob.update({
      where: { id: jobId },
      data: {
        status: "PROCESSING",
        attempts: { increment: 1 },
        startedAt: new Date()
      }
    });
  },
  async markJobCompleted(jobId, data) {
    await prisma.mediaJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        caption: data.caption,
        labels: data.labels as never,
        safetyResult: data.safetyResult as never,
        flagged: false,
        flaggedCategory: null,
        completedAt: new Date()
      }
    });
  },
  async markJobFlagged(jobId, data) {
    const job = await prisma.mediaJob.findUnique({
      where: { id: jobId },
      select: { userId: true }
    });

    await prisma.$transaction(async (tx) => {
      await tx.mediaJob.update({
        where: { id: jobId },
        data: {
          status: "FLAGGED",
          caption: data.caption,
          labels: data.labels as never,
          safetyResult: data.safetyResult as never,
          flagged: true,
          flaggedCategory: data.flaggedCategory,
          completedAt: new Date()
        }
      });

      if (job?.userId) {
        await tx.notification.create({
          data: {
            userId: job.userId,
            title: "Content flagged",
            body: `A media job was flagged for ${data.flaggedCategory}.`,
            dataJson: { jobId, flaggedCategory: data.flaggedCategory } as never
          }
        });
      }
    });
  },
  async markJobFailed(jobId, errorJson) {
    await prisma.mediaJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        lastError: errorJson as never
      }
    });
  },
  async markStepProcessing(stepId) {
    await prisma.jobStep.update({
      where: { id: stepId },
      data: {
        status: "PROCESSING",
        attempt: { increment: 1 },
        startedAt: new Date(),
        errorJson: Prisma.DbNull
      }
    });
  },
  async markStepCompleted(stepId, outputJson) {
    await prisma.jobStep.update({
      where: { id: stepId },
      data: {
        status: "COMPLETED",
        outputJson: outputJson as never,
        completedAt: new Date()
      }
    });
  },
  async markStepFailed(stepId, errorJson) {
    await prisma.jobStep.update({
      where: { id: stepId },
      data: {
        status: "FAILED",
        errorJson: errorJson as never
      }
    });
  },
  async updateJobArtifacts(jobId, patch) {
    await prisma.mediaJob.update({
      where: { id: jobId },
      data: patch as never
    });
  },
  async resetFailedJobForRetry(jobId) {
    await prisma.$transaction(async (tx) => {
      await tx.mediaJob.update({
        where: { id: jobId },
        data: {
          status: "PENDING",
          attempts: 0,
          lastError: Prisma.DbNull,
          failedAt: null,
          queuedAt: new Date()
        }
      });

      await tx.jobStep.updateMany({
        where: {
          jobId,
          status: "FAILED"
        },
        data: {
          status: "PENDING",
          errorJson: Prisma.DbNull,
          startedAt: null,
          completedAt: null
        }
      });
    });
  }
};
