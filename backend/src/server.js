import { PrismaClient } from '@prisma/client';
import { config, assertConfig } from './config.js';
import { createLogger } from './utils/logger.js';
import { createMailer } from './utils/mailer.js';
import { createApp } from './app.js';

assertConfig(config);

const logger = createLogger(config);
const prisma = new PrismaClient();
const mailer = createMailer(config, logger);
const app = createApp({ prisma, config, mailer, logger });

const server = app.listen(config.port, () => {
  logger.info(`${config.siteName} API listening on :${config.port} (${config.env})`);
});

const shutdown = async (signal) => {
  logger.info(`${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => logger.error(`unhandledRejection: ${err?.stack || err}`));
