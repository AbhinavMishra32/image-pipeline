CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FLAGGED', 'FAILED');
CREATE TYPE "StepStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "StepName" AS ENUM ('IMAGE_CAPTIONING', 'LABEL_DETECTION', 'CONTENT_SAFETY');
CREATE TYPE "JobEventType" AS ENUM ('JOB_CREATED', 'JOB_QUEUED', 'JOB_STARTED', 'STEP_STARTED', 'STEP_COMPLETED', 'STEP_FAILED', 'STEP_REUSED', 'JOB_COMPLETED', 'JOB_FLAGGED', 'JOB_FAILED', 'JOB_RETRIED');

CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "media_jobs" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "original_filename" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "storage_provider" TEXT NOT NULL,
  "storage_bucket" TEXT NOT NULL,
  "storage_key" TEXT NOT NULL,
  "status" "JobStatus" NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 3,
  "caption" TEXT,
  "labels" JSONB,
  "safety_result" JSONB,
  "flagged" BOOLEAN NOT NULL DEFAULT false,
  "flagged_category" TEXT,
  "last_error" JSONB,
  "queued_at" TIMESTAMP(3),
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "failed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "media_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "job_steps" (
  "id" TEXT NOT NULL,
  "job_id" TEXT NOT NULL,
  "name" "StepName" NOT NULL,
  "position" INTEGER NOT NULL,
  "status" "StepStatus" NOT NULL,
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "output_json" JSONB,
  "error_json" JSONB,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "job_steps_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "job_events" (
  "id" TEXT NOT NULL,
  "job_id" TEXT NOT NULL,
  "type" "JobEventType" NOT NULL,
  "payload_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "job_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notifications" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "read_at" TIMESTAMP(3),
  "data_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "media_jobs_user_id_created_at_idx" ON "media_jobs"("user_id", "created_at");
CREATE UNIQUE INDEX "job_steps_job_id_name_key" ON "job_steps"("job_id", "name");
CREATE INDEX "job_steps_job_id_position_idx" ON "job_steps"("job_id", "position");
CREATE INDEX "job_events_job_id_created_at_idx" ON "job_events"("job_id", "created_at");
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

ALTER TABLE "media_jobs" ADD CONSTRAINT "media_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_steps" ADD CONSTRAINT "job_steps_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "media_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_events" ADD CONSTRAINT "job_events_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "media_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
