# Engineering Decisions

## 1. Postgres owns job truth; Redis owns delivery

Redis is intentionally not treated as the durable state machine. BullMQ is used for delivery, backoff, worker coordination, and retry scheduling, while Postgres owns job status, step outputs, failure metadata, notifications, and the event timeline.

This keeps recovery behavior explicit. If a worker dies mid-step, the queue can redeliver work, but the database still tells us which steps completed, which step failed, what output was persisted, and whether the user should see a terminal failure. It also makes manual retry a database transition instead of a queue-only operation.

The main tradeoff is extra writes during processing. For this assignment that is the right tradeoff because debuggability and correctness matter more than minimizing write volume. At higher throughput I would tune indexes, separate operational event retention from long-term results, and move high-cardinality analytics out of the transactional path.

## 2. One worker executes the ordered pipeline

Each media job is processed by one worker execution that runs captioning, label extraction, then safety classification in sequence. The steps are still represented independently in the database, so completed steps can be reused after retries.

I avoided splitting each AI step into a separate queue because the current pipeline has strict per-image ordering and only three stages. A single worker execution gives clearer ownership over the job lifecycle, fewer partial orchestration states, and simpler local operation. Horizontal scale is still available by increasing worker replicas and BullMQ concurrency.

If this grew into a larger media system with heterogeneous latency or cost per stage, I would split the stages into dedicated queues and add an orchestrator or workflow engine. For this scope, that would add coordination complexity without improving the reviewer-facing behavior.

## 3. Multimodal LLMs through OpenRouter

The assignment allowed flexibility on the AI provider, so I chose OpenRouter-backed multimodal LLMs instead of separate captioning, labeling, and safety vendors. I have been working with LLM-based vision systems recently, and for mixed real-world uploads such as screenshots, documents, product photos, and natural images, multimodal LLMs often produce more useful semantic results than narrow task-specific endpoints.

The risk with LLMs is output drift. I control that by treating provider output as untrusted until it passes schema validation. Captions, labels, and safety results are parsed as strict JSON, and invalid responses fail the step instead of being silently coerced.

For safety, the provider is required to return a SafeSearch-style likelihood map. The application, not the model prose, decides whether an image is flagged: any `LIKELY` or `VERY_LIKELY` category becomes a flagged job.

## 4. Retry is step-aware, not job-blind

BullMQ handles automatic retries with exponential backoff until `maxAttempts` is exhausted. During those retryable attempts, the job is not finalized as `FAILED`; only the failed step records the latest error. Once retries are exhausted, the job transitions to terminal `FAILED` and the UI exposes manual retry.

Manual retry resets the job attempt counter to `0`, clears terminal failure fields, and requeues the same job. Completed steps remain completed, so successful upstream work is not repeated unnecessarily.

This makes retries cheaper and easier to reason about, but it does require step outputs to be idempotent enough to reuse. For this task that is acceptable because each step stores the exact output used by downstream stages.

## 5. Upload trust boundary is enforced before storage

The upload endpoint rejects invalid media before object storage, database writes, or queueing. It checks authentication, file size, allowed MIME type, and the image file signature for JPG, PNG, and WEBP.

MIME validation alone is not enough because clients can spoof `Content-Type`. Signature checks are a small amount of code, but they move the API closer to a real ingestion boundary. This does not replace malware scanning or image normalization, which I would add before production use.

## 6. Object storage stays behind the API

Images are stored in S3-compatible object storage and served back through authenticated API routes. The browser never receives internal MinIO container hostnames or storage credentials.

This centralizes ownership checks and keeps the storage backend replaceable. The tradeoff is that the API currently proxies image bytes. At scale I would move to short-lived signed CDN URLs after authorization, especially for larger media or high read volume.

## 7. Polling is the first realtime transport

The UI polls active jobs and notifications instead of using WebSockets or SSE. Polling is operationally boring, survives local Docker and single-node deployments cleanly, and is enough for background jobs where updates arrive seconds apart.

The frontend still presents the data as a live timeline, so the UX communicates progress without requiring push infrastructure. If job volume or collaboration requirements increased, I would move active job updates to SSE first, then WebSockets only if bidirectional realtime interaction became necessary.

## 8. Rate limiting is local now, distributed later

Authentication and upload endpoints have API-layer rate limits. The current limiter is process-local because the assignment stack must run cleanly from `docker compose up` without managed dependencies.

That is intentionally not the long-term design. In a multi-instance deployment, I would move rate limits to a shared system such as Unkey or Redis-backed counters, then add per-user quotas, per-IP limits, and per-user concurrent processing caps.

## 9. The UI is built around the workflow

The frontend is built around the actual flow of the system: auth, upload, job list, job detail, retry, flagged notifications, health, and the event timeline.

I did not try to turn this into a big product UI. The point is to make the pipeline easy to inspect: uploads return immediately, the worker moves the job forward in the background, failures are visible, retries are obvious, and flagged content stands out.
