import crypto from "node:crypto";
import type express from "express";

export function attachRequestContext(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const startedAt = process.hrtime.bigint();
  const requestId = req.header("x-request-id") || crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    console.log(JSON.stringify({
      level: "info",
      event: "api.request.completed",
      timestamp: new Date().toISOString(),
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2))
    }));
  });

  next();
}

export function logApiError(req: express.Request, error: unknown) {
  console.error(JSON.stringify({
    level: "error",
    event: "api.request.failed",
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    error: error instanceof Error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      : {
          name: "UnknownError",
          message: String(error)
        }
  }));
}
