import { Router } from "express";
import { z } from "zod";
import { clearAuthCookie, setAuthCookie } from "../auth/cookie.js";
import { signAuthToken } from "../auth/jwt.js";
import { login, signup } from "../auth/service.js";
import { config } from "../config.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { createRateLimit } from "../middleware/rate-limit.js";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const authRouter = Router();
const authRateLimit = createRateLimit({
  keyPrefix: "auth",
  limit: config.authRateLimitMax,
  windowMs: config.authRateLimitWindowMs,
  message: "Too many authentication requests. Please try again shortly."
});

authRouter.post("/signup", authRateLimit, async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid signup payload" });
  }

  try {
    const user = await signup(parsed.data.email.toLowerCase(), parsed.data.password);
    const token = signAuthToken({ sub: user.id, email: user.email });
    setAuthCookie(res, token);
    return res.status(201).json({ user });
  } catch {
    return res.status(409).json({ message: "Email already exists" });
  }
});

authRouter.post("/login", authRateLimit, async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid login payload" });
  }

  const user = await login(parsed.data.email.toLowerCase(), parsed.data.password);

  if (!user) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const token = signAuthToken({ sub: user.id, email: user.email });
  setAuthCookie(res, token);
  return res.json({ user });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  return res.json({ user: req.authUser! });
});

authRouter.post("/logout", async (_req, res) => {
  clearAuthCookie(res);
  return res.json({ ok: true });
});
