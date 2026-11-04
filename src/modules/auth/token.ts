import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";

interface AccessTokenPayload {
  sub: string;
  role: "CUSTOMER" | "DRIVER" | "ADMIN";
}

export const ACCESS_TOKEN_MAX_AGE_MS = (() => {
  const match = /^(\d+)(s|m|h|d)$/.exec(env.JWT_EXPIRES_IN);

  if (!match) {
    throw new Error("Invalid JWT_EXPIRES_IN format");
  }

  const value = Number(match[1]);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  if (!unit || !multipliers[unit]) {
    throw new Error("Invalid JWT_EXPIRES_IN unit");
  }

  return value * multipliers[unit];
})();

export function generateAccessToken(
  payload: AccessTokenPayload
): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    issuer: "fleetflow",
    audience: "fleetflow-api"
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET, {
    issuer: "fleetflow",
    audience: "fleetflow-api",
    algorithms: ["HS256"]
  });

  if (
    typeof decoded === "string" ||
    typeof decoded.sub !== "string" ||
    !["CUSTOMER", "DRIVER", "ADMIN"].includes(String(decoded.role))
  ) {
    throw new Error("Invalid token payload");
  }

  return {
    sub: decoded.sub,
    role: decoded.role as AccessTokenPayload["role"]
  };
}