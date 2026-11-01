import winston from 'winston';

export function createLogger(config) {
  return winston.createLogger({
    level: config.isProd ? 'info' : 'debug',
    silent: config.isTest,
    format: config.isProd
      ? winston.format.combine(winston.format.timestamp(), winston.format.json())
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp({ format: 'HH:mm:ss' }),
          winston.format.printf(
            ({ timestamp, level, message, stack }) => `${timestamp} ${level} ${stack || message}`,
          ),
        ),
    transports: [new winston.transports.Console()],
  });
}
