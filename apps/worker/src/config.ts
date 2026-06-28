import "dotenv/config";

function readEnv(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback;

  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }

  return value;
}

function readOptionalEnv(name: string, fallback = "") {
  return process.env[name] ?? fallback;
}

export const config = {
  databaseUrl: readEnv("DATABASE_URL"),
  redisUrl: readEnv("REDIS_URL", "redis://127.0.0.1:6379"),
  minioEndpoint: readEnv("MINIO_ENDPOINT", "127.0.0.1"),
  minioPort: Number(readEnv("MINIO_PORT", "9000")),
  minioAccessKey: readEnv("MINIO_ACCESS_KEY", "minioadmin"),
  minioSecretKey: readEnv("MINIO_SECRET_KEY", "minioadmin"),
  minioUseSsl: readEnv("MINIO_USE_SSL", "false") === "true",
  openRouterApiKey: readOptionalEnv("OPENROUTER_API_KEY"),
  openRouterCaptionModel: readEnv("OPENROUTER_CAPTION_MODEL", "openrouter/free"),
  openRouterLabelModel: readEnv("OPENROUTER_LABEL_MODEL", "openrouter/free"),
  openRouterSafetyModel: readEnv(
    "OPENROUTER_SAFETY_MODEL",
    "nvidia/nemotron-3.5-content-safety:free"
  )
} as const;
