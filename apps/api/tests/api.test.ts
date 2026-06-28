import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateUploadFile } from "../src/validators/upload.js";

const mockGetJobForUser = vi.fn();

vi.mock("../src/middleware/auth.js", () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.authUser = {
      id: "user_1",
      email: "user_1@example.com"
    };
    next();
  }
}));

vi.mock("../src/services/jobs.service.js", () => ({
  createJobForUpload: vi.fn(),
  deriveCurrentStage: vi.fn(() => "IMAGE_CAPTIONING"),
  getJobForUser: (...args: unknown[]) => mockGetJobForUser(...args),
  listJobsForUser: vi.fn(async () => []),
  retryJobForUser: vi.fn()
}));

vi.mock("../src/lib/storage.js", () => ({
  getObjectBuffer: vi.fn(),
  getPresignedObjectUrl: vi.fn(async () => "http://localhost:9000/fake-image")
}));

const { jobsRouter } = await import("../src/routes/jobs.routes.js");

function createTestFile(overrides: Partial<Express.Multer.File>): Express.Multer.File {
  return {
    fieldname: "image",
    originalname: "image.png",
    encoding: "7bit",
    mimetype: "image/png",
    size: 8,
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    stream: undefined as never,
    destination: "",
    filename: "",
    path: "",
    ...overrides
  };
}

describe("upload validation", () => {
  it("rejects files over 5MB", () => {
    expect(() =>
      validateUploadFile(createTestFile({
        originalname: "big.png",
        size: 6 * 1024 * 1024,
        buffer: Buffer.alloc(1)
      }))
    ).toThrow("Image exceeds 5MB limit");
  });

  it("accepts a PNG with a matching file signature", () => {
    expect(() => validateUploadFile(createTestFile({}))).not.toThrow();
  });

  it("rejects files whose content does not match the declared type", () => {
    expect(() =>
      validateUploadFile(createTestFile({
        originalname: "spoof.png",
        buffer: Buffer.from("not actually a png")
      }))
    ).toThrow("Image content does not match the declared type");
  });
});

describe("job ownership access", () => {
  beforeEach(() => {
    mockGetJobForUser.mockReset();
  });

  it("returns 404 when the requested job is not owned by the current user", async () => {
    mockGetJobForUser.mockResolvedValue(null);

    const app = express();
    app.use(express.json());
    app.use("/api/jobs", jobsRouter);

    const response = await request(app).get("/api/jobs/job_from_someone_else");

    expect(mockGetJobForUser).toHaveBeenCalledWith("user_1", "job_from_someone_else");
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Job not found" });
  });
});
