import bcrypt from "bcryptjs";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { prisma } from "./lib/prisma.js";
import { ensureBucket } from "./lib/storage.js";

async function bootstrap() {
  const passwordHash = await bcrypt.hash("password123", 10);

  await ensureBucket();

  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      passwordHash
    }
  });
}

let server: import("http").Server | undefined;

async function shutdown() {
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
  }
  await prisma.$disconnect();
  process.exit(0);
}

try {
  await bootstrap();
  const app = createApp();
  server = app.listen(config.port, config.host, () => {
    console.log(JSON.stringify({
      level: "info",
      event: "api.server.started",
      timestamp: new Date().toISOString(),
      host: config.host,
      port: config.port
    }));
  });
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
} catch (error) {
  console.error(JSON.stringify({
    level: "error",
    event: "api.server.start_failed",
    timestamp: new Date().toISOString(),
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
  await prisma.$disconnect();
  process.exit(1);
}
