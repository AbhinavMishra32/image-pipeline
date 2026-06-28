import type { Request, Response } from "express";

const cookieName = "image_pipeline_token";

function serializeCookie(value: string, maxAgeSeconds: number) {
  return [
    `${cookieName}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`
  ].join("; ");
}

export function setAuthCookie(res: Response, token: string) {
  res.setHeader("Set-Cookie", serializeCookie(token, 60 * 60 * 24 * 7));
}

export function clearAuthCookie(res: Response) {
  res.setHeader("Set-Cookie", serializeCookie("", 0));
}

export function readAuthToken(req: Request) {
  const authorization = req.header("authorization");

  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length);
  }

  const cookieHeader = req.header("cookie");
  const match = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`));

  return match ? decodeURIComponent(match.slice(cookieName.length + 1)) : null;
}
