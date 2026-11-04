import { z } from "zod";
import { Buffer } from "node:buffer";

export const loginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),

  password: z.string()
    .min(1)
    .refine(
      (password) => Buffer.byteLength(password, "utf8") <= 72,
      {
        message: "Password must not exceed 72 bytes"
      }
    )
}).strict();

export type LoginInput = z.infer<typeof loginSchema>;