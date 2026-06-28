import "dotenv/config";

function readEnv(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback;

  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }

  return value;
}

function readOptionalEnv(name: string) {
  return process.env[name] ?? "";
}

export const config = {
  appName: "image-pipeline",
  host: readEnv("API_HOST", "127.0.0.1"),
  port: Number(readEnv("PORT", "3001")),
  databaseUrl: readEnv("DATABASE_URL"),
  redisUrl: readEnv("REDIS_URL", "redis://127.0.0.1:6379"),
  minioEndpoint: readEnv("MINIO_ENDPOINT", "127.0.0.1"),
  minioPort: Number(readEnv("MINIO_PORT", "9000")),
  minioAccessKey: readEnv("MINIO_ACCESS_KEY", "minioadmin"),
  minioSecretKey: readEnv("MINIO_SECRET_KEY", "minioadmin"),
  minioBucket: readEnv("MINIO_BUCKET", "media"),
  minioUseSsl: readEnv("MINIO_USE_SSL", "false") === "true",
  jwtSecret: readEnv("JWT_SECRET"),
  corsOrigins: readOptionalEnv("CORS_ORIGINS")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  authRateLimitMax: Number(readEnv("AUTH_RATE_LIMIT_MAX", "10")),
  authRateLimitWindowMs: Number(readEnv("AUTH_RATE_LIMIT_WINDOW_MS", "60000")),
  uploadRateLimitMax: Number(readEnv("UPLOAD_RATE_LIMIT_MAX", "30")),
  uploadRateLimitWindowMs: Number(readEnv("UPLOAD_RATE_LIMIT_WINDOW_MS", "60000"))
} as const;
