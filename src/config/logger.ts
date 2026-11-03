import pino from "pino";
import pinoHttpModule from "pino-http";
import { env } from "./env.js";

const pinoHttp = pinoHttpModule.default ?? pinoHttpModule;

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug"
});

export const httpLogger = pinoHttp({
  logger
});