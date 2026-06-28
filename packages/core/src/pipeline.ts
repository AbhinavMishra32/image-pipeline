import {
  orderedSteps,
  type CaptionResult,
  type JobStepRecord,
  type LabelResult,
  type MediaJobRecord,
  type SafetyResult,
  type StepName
} from "./jobs.js";
import type { StructuredOutputError, VisionProvider } from "./openrouter.js";

export type StorageObject = {
  bucket: string;
  key: string;
};

export type PipelineStore = {
  getJob(jobId: string): Promise<MediaJobRecord | null>;
  getStep(jobId: string, stepName: StepName): Promise<JobStepRecord | null>;
  listSteps(jobId: string): Promise<JobStepRecord[]>;
  createEvent(jobId: string, type: string, payload?: unknown): Promise<void>;
  markJobProcessing(jobId: string): Promise<void>;
  markJobCompleted(jobId: string, data: { caption: string; labels: unknown; safetyResult: unknown }): Promise<void>;
  markJobFlagged(jobId: string, data: { caption: string; labels: unknown; safetyResult: unknown; flaggedCategory: string }): Promise<void>;
  markJobFailed(jobId: string, errorJson: unknown): Promise<void>;
  markStepProcessing(stepId: string): Promise<void>;
  markStepCompleted(stepId: string, outputJson: unknown): Promise<void>;
  markStepFailed(stepId: string, errorJson: unknown): Promise<void>;
  updateJobArtifacts(jobId: string, patch: Partial<Pick<MediaJobRecord, "caption" | "labels" | "safetyResult">>): Promise<void>;
  resetFailedJobForRetry(jobId: string): Promise<void>;
};

export type StorageReader = {
  readObject(object: StorageObject): Promise<Buffer>;
};

export async function runStep<T>(
  store: PipelineStore,
  jobId: string,
  stepName: StepName,
  execute: () => Promise<T>
) {
  const step = await store.getStep(jobId, stepName);

  if (!step) {
    throw new Error(`Step ${stepName} not found`);
  }

  if (step.status === "COMPLETED") {
    await store.createEvent(jobId, "STEP_REUSED", { stepName });
    return step.outputJson as T;
  }

  const previousSteps = (await store.listSteps(jobId))
    .filter((candidate) => candidate.position < step.position);

  if (previousSteps.some((candidate) => candidate.status !== "COMPLETED")) {
    throw new Error(`Previous steps must complete before ${stepName}`);
  }

  await store.markStepProcessing(step.id);
  await store.createEvent(jobId, "STEP_STARTED", { stepName });

  try {
    const output = await execute();
    await store.markStepCompleted(step.id, output);
    await store.createEvent(jobId, "STEP_COMPLETED", { stepName });
    return output;
  } catch (error) {
    const errorJson = serializeError(error);
    await store.markStepFailed(step.id, errorJson);
    await store.createEvent(jobId, "STEP_FAILED", { stepName, error: errorJson });
    throw error;
  }
}

export async function processMediaJob(
  store: PipelineStore,
  storage: StorageReader,
  provider: VisionProvider,
  jobId: string,
  object: StorageObject,
  options?: {
    finalizeFailure?: boolean;
  }
) {
  const job = await store.getJob(jobId);

  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  await store.markJobProcessing(jobId);
  await store.createEvent(jobId, "JOB_STARTED");

  try {
    const imageBuffer = await storage.readObject(object);
    const imageDataUrl = `data:image/*;base64,${imageBuffer.toString("base64")}`;

    const captionOutput = await runStep<{ caption: string; rawText: string }>(
      store,
      jobId,
      "IMAGE_CAPTIONING",
      async () => {
        const response = await provider.captionImage(imageDataUrl);
        const output = {
          caption: response.parsed.caption,
          rawText: response.rawText
        };
        await store.updateJobArtifacts(jobId, { caption: response.parsed.caption });
        return output;
      }
    );

    const labelOutput = await runStep<{ labels: unknown; rawText: string }>(
      store,
      jobId,
      "LABEL_DETECTION",
      async () => {
        const response = await provider.detectLabels(imageDataUrl);
        const output = {
          labels: response.parsed.labels,
          rawText: response.rawText
        };
        await store.updateJobArtifacts(jobId, { labels: response.parsed.labels });
        return output;
      }
    );

    const safetyOutput = await runStep<{ result: unknown; rawText: string }>(
      store,
      jobId,
      "CONTENT_SAFETY",
      async () => {
        const response = await provider.checkContentSafety(imageDataUrl);
        const output = {
          result: {
            ...response.parsed,
            rawText: response.rawText
          },
          rawText: response.rawText
        };
        await store.updateJobArtifacts(jobId, { safetyResult: output.result });
        return output;
      }
    );

    const safetyResult = safetyOutput.result as SafetyResult & { rawText: string };

    if (safetyResult.flagged || !safetyResult.safe) {
      await store.markJobFlagged(jobId, {
        caption: captionOutput.caption,
        labels: labelOutput.labels,
        safetyResult,
        flaggedCategory: safetyResult.primaryCategory
      });
      await store.createEvent(jobId, "JOB_FLAGGED", {
        category: safetyResult.primaryCategory
      });
      return { status: "FLAGGED" as const };
    }

    await store.markJobCompleted(jobId, {
      caption: captionOutput.caption,
      labels: labelOutput.labels,
      safetyResult
    });
    await store.createEvent(jobId, "JOB_COMPLETED");
    return { status: "COMPLETED" as const };
  } catch (error) {
    if (options?.finalizeFailure ?? true) {
      await store.markJobFailed(jobId, serializeError(error));
      await store.createEvent(jobId, "JOB_FAILED", { error: serializeError(error) });
    }
    throw error;
  }
}

export async function retryFailedJob(store: PipelineStore, jobId: string, status: string) {
  if (status !== "FAILED") {
    throw new Error("Only FAILED jobs can be retried");
  }

  await store.resetFailedJobForRetry(jobId);
  await store.createEvent(jobId, "JOB_RETRIED");
}

export function serializeError(error: unknown) {
  if (error && typeof error === "object" && "name" in error && "message" in error) {
    const structured = error as Error & Partial<StructuredOutputError>;
    return {
      name: structured.name,
      message: structured.message,
      stack: structured.stack,
      rawText: structured.rawText,
      details: structured.details
    };
  }

  return {
    name: "Error",
    message: typeof error === "string" ? error : "Unknown error"
  };
}
