import jwt from "jsonwebtoken";
import { config } from "../config.js";

export type AuthJwtPayload = {
  sub: string;
  email: string;
};

export function signAuthToken(payload: AuthJwtPayload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: "7d" });
}

export function verifyAuthToken(token: string) {
  return jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
}
