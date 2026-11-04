import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),

  email: z.string().trim().email().toLowerCase(),

  password: z.string().min(8).max(72)
}).strict();


export type RegisterInput = z.infer<typeof registerSchema>;