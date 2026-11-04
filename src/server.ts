import app from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";

const server = app.listen(env.PORT, () => {
  logger.info(`${env.APP_NAME} running on port ${env.PORT}`);
});

function shutdown(signal: string) {
  logger.info(`${signal} received. Shutting down...`);

  server.close((error) => {
    if (error) {
      logger.error(error);
      process.exitCode = 1;
      return;
    }

    logger.info("HTTP server closed");
    process.exitCode = 0;
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
