import "dotenv/config";
import net from "node:net";
import { spawn, spawnSync } from "node:child_process";

const checks = [
  { label: "Postgres", port: Number(new URL(process.env.DATABASE_URL!).port || 5432), host: new URL(process.env.DATABASE_URL!).hostname },
  { label: "Redis", port: Number(new URL(process.env.REDIS_URL!).port || 6379), host: new URL(process.env.REDIS_URL!).hostname },
  { label: "MinIO", port: Number(process.env.MINIO_PORT ?? 9000), host: process.env.MINIO_ENDPOINT ?? "127.0.0.1" }
];

function waitForPort(host: string, port: number, label: string) {
  const timeoutMs = 20_000;
  const startedAt = Date.now();

  return new Promise<void>((resolve, reject) => {
    const attempt = () => {
      const socket = net.createConnection({ host, port });

      socket.once("connect", () => {
        socket.end();
        resolve();
      });

      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`${label} was not ready at ${host}:${port} within ${timeoutMs}ms`));
          return;
        }
        setTimeout(attempt, 500);
      });
    };

    attempt();
  });
}

async function main() {
  for (const check of checks) {
    await waitForPort(check.host, check.port, check.label);
  }

  const migrate = spawnSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: process.env
  });

  if ((migrate.status ?? 1) !== 0) {
    process.exit(migrate.status ?? 1);
  }

  const server = spawn("pnpm", ["exec", "tsx", "src/server.ts"], {
    stdio: "inherit",
    env: process.env
  });

  process.on("SIGINT", () => server.kill("SIGINT"));
  process.on("SIGTERM", () => server.kill("SIGTERM"));
  server.on("exit", (code) => process.exit(code ?? 0));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
