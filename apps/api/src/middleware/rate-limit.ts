import type { NextFunction, Request, Response } from "express";

type RateLimitOptions = {
  keyPrefix: string;
  limit: number;
  windowMs: number;
  message: string;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function getClientKey(req: Request, keyPrefix: string) {
  const forwardedFor = req.header("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || req.ip || "unknown";
  return `${keyPrefix}:${ip}`;
}

export function createRateLimit(options: RateLimitOptions) {
  return function rateLimit(req: Request, res: Response, next: NextFunction) {
    const now = Date.now();
    const key = getClientKey(req, options.keyPrefix);
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + options.windowMs
      });
      return next();
    }

    if (existing.count >= options.limit) {
      res.setHeader("Retry-After", Math.ceil((existing.resetAt - now) / 1000));
      return res.status(429).json({
        message: options.message,
        requestId: req.requestId
      });
    }

    existing.count += 1;
    return next();
  };
}
