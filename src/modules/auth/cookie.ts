import type { CookieOptions } from "express";
import { env } from "../../config/env.js";

export const accessTokenCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/"
};