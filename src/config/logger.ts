import pino from "pino";
import pinoHttpModule from "pino-http";
import { env } from "./env.js";
import type { RequestHandler } from "express";

type PinoHttpFactory = (options: {
  logger: pino.Logger;
}) => RequestHandler;

const pinoHttp =
  (pinoHttpModule as unknown as {
    default?: PinoHttpFactory;
  }).default ??
  (pinoHttpModule as unknown as PinoHttpFactory);

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug"
});

export const httpLogger = pinoHttp({ logger });