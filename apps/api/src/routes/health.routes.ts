import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  try {
    const [databaseTime, userCount] = await Promise.all([
      prisma.$queryRaw<{ now: Date }[]>`select now() as now`,
      prisma.user.count()
    ]);

    return res.json({
      status: "ok",
      uptime: process.uptime(),
      database: "ok",
      databaseTime: databaseTime[0]?.now ?? null,
      userCount
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error instanceof Error ? error.message : "Health check failed"
    });
  }
});
