import rateLimit from 'express-rate-limit';

export function makeLimiters(config) {
  const make = (windowMs, limit, message) =>
    rateLimit({
      windowMs,
      limit,
      standardHeaders: true,
      legacyHeaders: false,
      skip: () => config.rateLimitDisabled,
      message: { error: message },
    });

  return {
    general: make(15 * 60 * 1000, 600, 'Too many requests, please slow down.'),
    login: make(15 * 60 * 1000, 10, 'Too many login attempts. Try again in a few minutes.'),
    apply: make(60 * 60 * 1000, 5, 'Too many applications from this address. Try again later.'),
    post: make(10 * 60 * 1000, 20, 'You are posting too quickly. Please wait a moment.'),
    contact: make(60 * 60 * 1000, 5, 'Too many messages. Try again later.'),
  };
}
