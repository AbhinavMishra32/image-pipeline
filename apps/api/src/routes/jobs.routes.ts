import multer from "multer";
import { Router } from "express";
import { maxUploadBytes } from "@image-pipeline/core";
import { config } from "../config.js";
import { requireAuth } from "../middleware/auth.js";
import { createRateLimit } from "../middleware/rate-limit.js";
import { validateUploadFile } from "../validators/upload.js";
import {
  createJobForUpload,
  deriveCurrentStage,
  getJobForUser,
  listJobsForUser,
  retryJobForUser
} from "../services/jobs.service.js";
import { getObjectBuffer } from "../lib/storage.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxUploadBytes
  }
});

export const jobsRouter = Router();
const uploadRateLimit = createRateLimit({
  keyPrefix: "upload",
  limit: config.uploadRateLimitMax,
  windowMs: config.uploadRateLimitWindowMs,
  message: "Too many uploads in a short period. Please wait before trying again."
});

jobsRouter.use(requireAuth);

jobsRouter.post("/", uploadRateLimit, upload.single("image"), async (req, res) => {
  try {
    validateUploadFile(req.file);
  } catch (error) {
    return res.status(400).json({
      message: error instanceof Error ? error.message : "Invalid upload"
    });
  }

  const result = await createJobForUpload({
    userId: req.authUser!.id,
    file: req.file!
  });

  return res.status(201).json(result);
});

jobsRouter.get("/", async (req, res) => {
  const jobs = await listJobsForUser(req.authUser!.id);

  return res.json({
    jobs: jobs.map((job) => ({
      ...job,
      currentStage: deriveCurrentStage(job.steps),
      imageUrl: `/api/jobs/${job.id}/image`
    }))
  });
});

jobsRouter.get("/:jobId", async (req, res) => {
  const job = await getJobForUser(req.authUser!.id, req.params.jobId);

  if (!job) {
    return res.status(404).json({ message: "Job not found" });
  }

  return res.json({
    job: {
      ...job,
      currentStage: deriveCurrentStage(job.steps),
      imageUrl: `/api/jobs/${job.id}/image`
    }
  });
});

jobsRouter.get("/:jobId/image", async (req, res) => {
  const job = await getJobForUser(req.authUser!.id, req.params.jobId);

  if (!job) {
    return res.status(404).json({ message: "Job not found" });
  }

  const buffer = await getObjectBuffer(job.storageBucket, job.storageKey);
  res.setHeader("Content-Type", job.mimeType);
  return res.send(buffer);
});

jobsRouter.post("/:jobId/retry", async (req, res) => {
  try {
    const result = await retryJobForUser(req.authUser!.id, req.params.jobId);

    if (!result) {
      return res.status(404).json({ message: "Job not found" });
    }

    return res.json(result);
  } catch (error) {
    return res.status(400).json({
      message: error instanceof Error ? error.message : "Retry failed"
    });
  }
});
