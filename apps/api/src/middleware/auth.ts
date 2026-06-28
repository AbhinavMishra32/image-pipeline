import type { NextFunction, Request, Response } from "express";
import { readAuthToken } from "../auth/cookie.js";
import { verifyAuthToken } from "../auth/jwt.js";
import { getUserById } from "../auth/service.js";

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        id: string;
        email: string;
      };
    }
  }
}

export type AuthedRequest = Request & {
  authUser: NonNullable<Request["authUser"]>;
};

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = readAuthToken(req);

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const payload = verifyAuthToken(token);
    const userId = String(payload.sub ?? "");
    const user = await getUserById(userId);

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.authUser = user;
    return next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
}
