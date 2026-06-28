import cors from "cors";
import express from "express";
import multer from "multer";
import { apiReference } from "@scalar/express-api-reference";
import { authRouter } from "./routes/auth.routes.js";
import { jobsRouter } from "./routes/jobs.routes.js";
import { notificationsRouter } from "./routes/notifications.routes.js";
import { healthRouter } from "./routes/health.routes.js";
import { openApiDocument } from "./docs/openapi.js";
import { attachRequestContext, logApiError } from "./lib/observability.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: (_origin, callback) => callback(null, true),
      credentials: true
    })
  );
  app.use(attachRequestContext);
  app.use(express.json());

  app.get("/api/docs/openapi.json", (_req, res) => {
    res.json(openApiDocument);
  });

  app.use(
    "/api/docs",
    apiReference({
      url: "/api/docs/openapi.json",
      theme: "purple"
    })
  );

  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/jobs", jobsRouter);
  app.use("/api/notifications", notificationsRouter);

  app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "Image exceeds 5MB limit",
        requestId: req.requestId
      });
    }

    if (error instanceof Error && error.message === "Origin not allowed by CORS") {
      return res.status(403).json({
        message: error.message,
        requestId: req.requestId
      });
    }

    if (error instanceof SyntaxError) {
      return res.status(400).json({
        message: "Invalid JSON payload",
        requestId: req.requestId
      });
    }

    logApiError(req, error);
    return res.status(500).json({
      message: "Internal server error",
      requestId: req.requestId
    });
  });

  return app;
}
