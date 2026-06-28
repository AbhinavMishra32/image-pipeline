import { describe, expect, it } from "vitest";
import {
  processMediaJob,
  retryFailedJob,
  runStep,
  type PipelineStore,
  type StorageReader
} from "../src/pipeline.js";
import type { VisionProvider } from "../src/openrouter.js";
import type { JobStepRecord, MediaJobRecord } from "../src/jobs.js";

function createStore(overrides?: Partial<MediaJobRecord>) {
  const job: MediaJobRecord = {
    id: "job_1",
    userId: "user_1",
    status: "PENDING",
    attempts: 0,
    maxAttempts: 3,
    caption: null,
    labels: null,
    safetyResult: null,
    flagged: false,
    flaggedCategory: null,
    lastError: null,
    ...overrides
  };

  const steps: JobStepRecord[] = [
    {
      id: "step_1",
      jobId: job.id,
      name: "IMAGE_CAPTIONING",
      position: 1,
      status: "PENDING",
      attempt: 0,
      outputJson: null,
      errorJson: null
    },
    {
      id: "step_2",
      jobId: job.id,
      name: "LABEL_DETECTION",
      position: 2,
      status: "PENDING",
      attempt: 0,
      outputJson: null,
      errorJson: null
    },
    {
      id: "step_3",
      jobId: job.id,
      name: "CONTENT_SAFETY",
      position: 3,
      status: "PENDING",
      attempt: 0,
      outputJson: null,
      errorJson: null
    }
  ];

  const events: Array<{ type: string; payload?: unknown }> = [];

  const store: PipelineStore = {
    async getJob() {
      return job;
    },
    async getStep(_jobId, stepName) {
      return steps.find((step) => step.name === stepName) ?? null;
    },
    async listSteps() {
      return steps;
    },
    async createEvent(_jobId, type, payload) {
      events.push({ type, payload });
    },
    async markJobProcessing() {
      job.status = "PROCESSING";
      job.attempts += 1;
    },
    async markJobCompleted(_jobId, data) {
      job.status = "COMPLETED";
      job.caption = data.caption;
      job.labels = data.labels;
      job.safetyResult = data.safetyResult;
    },
    async markJobFlagged(_jobId, data) {
      job.status = "FLAGGED";
      job.flagged = true;
      job.flaggedCategory = data.flaggedCategory;
      job.caption = data.caption;
      job.labels = data.labels;
      job.safetyResult = data.safetyResult;
    },
    async markJobFailed(_jobId, errorJson) {
      job.status = "FAILED";
      job.lastError = errorJson;
    },
    async markStepProcessing(stepId) {
      const step = steps.find((candidate) => candidate.id === stepId)!;
      step.status = "PROCESSING";
      step.attempt += 1;
    },
    async markStepCompleted(stepId, outputJson) {
      const step = steps.find((candidate) => candidate.id === stepId)!;
      step.status = "COMPLETED";
      step.outputJson = outputJson;
      step.errorJson = null;
    },
    async markStepFailed(stepId, errorJson) {
      const step = steps.find((candidate) => candidate.id === stepId)!;
      step.status = "FAILED";
      step.errorJson = errorJson;
    },
    async updateJobArtifacts(_jobId, patch) {
      Object.assign(job, patch);
    },
    async resetFailedJobForRetry() {
      job.status = "PENDING";
      job.lastError = null;
      for (const step of steps) {
        if (step.status === "FAILED") {
          step.status = "PENDING";
          step.errorJson = null;
        }
      }
    }
  };

  return { job, steps, events, store };
}

const storage: StorageReader = {
  async readObject() {
    return Buffer.from("image");
  }
};

function createProvider(overrides?: Partial<VisionProvider>): VisionProvider {
  return {
    async captionImage() {
      return { parsed: { caption: "A dog in a park." }, rawText: "{\"caption\":\"A dog in a park.\"}" };
    },
    async detectLabels() {
      return {
        parsed: { labels: [{ name: "dog", confidence: "high" }] },
        rawText: "{\"labels\":[{\"name\":\"dog\",\"confidence\":\"high\"}]}"
      };
    },
    async checkContentSafety() {
      return {
        parsed: {
          safe: true,
          flagged: false,
          categories: [],
          primaryCategory: "",
          reason: "The image appears benign and does not show risky content.",
          ratings: {
            adult: "VERY_UNLIKELY",
            spoof: "VERY_UNLIKELY",
            medical: "VERY_UNLIKELY",
            violence: "VERY_UNLIKELY",
            racy: "UNLIKELY"
          }
        },
        rawText: "{\"safe\":true,\"flagged\":false,\"categories\":[],\"primaryCategory\":\"\",\"reason\":\"The image appears benign and does not show risky content.\",\"ratings\":{\"adult\":\"VERY_UNLIKELY\",\"spoof\":\"VERY_UNLIKELY\",\"medical\":\"VERY_UNLIKELY\",\"violence\":\"VERY_UNLIKELY\",\"racy\":\"UNLIKELY\"}}"
      };
    },
    ...overrides
  };
}

describe("pipeline", () => {
  it("enforces step ordering", async () => {
    const { store } = createStore();

    await expect(
      runStep(store, "job_1", "LABEL_DETECTION", async () => ({ ok: true }))
    ).rejects.toThrow("Previous steps must complete");
  });

  it("reuses completed steps", async () => {
    const { store, steps, events } = createStore();
    steps[0]!.status = "COMPLETED";
    steps[0]!.outputJson = { caption: "Already done" };

    const result = await runStep(store, "job_1", "IMAGE_CAPTIONING", async () => {
      throw new Error("should not run");
    });

    expect(result).toEqual({ caption: "Already done" });
    expect(events.some((event) => event.type === "STEP_REUSED")).toBe(true);
  });

  it("marks safe jobs as completed", async () => {
    const { store, job } = createStore();

    await processMediaJob(
      store,
      storage,
      createProvider(),
      "job_1",
      { bucket: "media", key: "one.jpg" }
    );

    expect(job.status).toBe("COMPLETED");
  });

  it("marks unsafe jobs as flagged", async () => {
    const { store, job } = createStore();

    await processMediaJob(
      store,
      storage,
      createProvider({
        async checkContentSafety() {
          return {
            parsed: {
              safe: false,
              flagged: true,
              categories: ["violence"],
              primaryCategory: "violence",
              reason: "The image contains clearly violent content.",
              ratings: {
                adult: "VERY_UNLIKELY",
                spoof: "UNLIKELY",
                medical: "POSSIBLE",
                violence: "VERY_LIKELY",
                racy: "UNLIKELY"
              }
            },
            rawText: "{\"safe\":false,\"flagged\":true,\"categories\":[\"violence\"],\"primaryCategory\":\"violence\",\"reason\":\"The image contains clearly violent content.\",\"ratings\":{\"adult\":\"VERY_UNLIKELY\",\"spoof\":\"UNLIKELY\",\"medical\":\"POSSIBLE\",\"violence\":\"VERY_LIKELY\",\"racy\":\"UNLIKELY\"}}"
          };
        }
      }),
      "job_1",
      { bucket: "media", key: "one.jpg" }
    );

    expect(job.status).toBe("FLAGGED");
    expect(job.flaggedCategory).toBe("violence");
  });

  it("stores failures and supports retry reset", async () => {
    const { store, job, steps } = createStore();

    await expect(
      processMediaJob(
        store,
        storage,
        createProvider({
          async detectLabels() {
            throw new Error("Label parsing failed");
          }
        }),
        "job_1",
        { bucket: "media", key: "one.jpg" }
      )
    ).rejects.toThrow("Label parsing failed");

    expect(job.status).toBe("FAILED");
    expect(steps[1]!.status).toBe("FAILED");

    await retryFailedJob(store, "job_1", job.status);

    expect(job.status).toBe("PENDING");
    expect(steps[0]!.status).toBe("COMPLETED");
    expect(steps[1]!.status).toBe("PENDING");
  });

  it("keeps the job active when a retryable attempt fails", async () => {
    const { store, job, steps, events } = createStore();

    await expect(
      processMediaJob(
        store,
        storage,
        createProvider({
          async detectLabels() {
            throw new Error("Temporary upstream failure");
          }
        }),
        "job_1",
        { bucket: "media", key: "one.jpg" },
        { finalizeFailure: false }
      )
    ).rejects.toThrow("Temporary upstream failure");

    expect(job.status).toBe("PROCESSING");
    expect(steps[1]!.status).toBe("FAILED");
    expect(events.some((event) => event.type === "JOB_FAILED")).toBe(false);
  });

  it("only retries failed jobs", async () => {
    const { store } = createStore({ status: "COMPLETED" });

    await expect(retryFailedJob(store, "job_1", "COMPLETED")).rejects.toThrow(
      "Only FAILED jobs can be retried"
    );
  });
});
