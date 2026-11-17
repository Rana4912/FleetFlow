
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  PORT: z.coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .default(3000),

  APP_NAME: z.string().default("FleetFlow"),

  DATABASE_URL: z.string().url(),

  JWT_SECRET: z.string().min(64),
  JWT_EXPIRES_IN: z.string().default("15m"),

  // Nominatim configuration (kept for provider flexibility)
  GEOCODING_BASE_URL: z
    .string()
    .url()
    .default("http://localhost:8080"),

  GEOCODING_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .max(30000)
    .default(5000),

  GEOCODING_USER_AGENT: z
    .string()
    .min(3)
    .default("FleetFlow/1.0"),

  // Geoapify configuration
  GEOCODING_API_KEY: z.string().min(1)
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid environment configuration:");
  console.error(parsedEnv.error.flatten().fieldErrors);

  process.exit(1);
}

export const env = parsedEnv.data;
