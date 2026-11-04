import { z } from "zod";
import { Buffer } from "node:buffer";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),

  email: z.string().trim().email().toLowerCase(),

  password: z.string()
    .min(8)
    .refine(
      (password) => Buffer.byteLength(password, "utf8") <= 72,
      {
        message: "Password must not exceed 72 bytes"
      }
    )
}).strict();

export type RegisterInput = z.infer<typeof registerSchema>;