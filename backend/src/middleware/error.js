import { HttpError } from '../utils/http.js';

export const notFound = (_req, _res, next) => next(new HttpError(404, 'Not found'));

/** Central error handler: never leaks stack traces or internals to clients. */
export const errorHandler = (logger) => (err, req, res, _next) => {
  let status = err.status || 500;
  let message = err.message;
  let details = err.details;

  if (err.name === 'MulterError') {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : 'Upload failed';
  } else if (err.code === 'P2002') {
    status = 409;
    message = 'That value is already in use';
  } else if (err.code === 'P2025') {
    status = 404;
    message = 'Record not found';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid JSON body';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Request body too large';
  }

  if (status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -> ${err.stack || err.message}`);
    message = 'Something went wrong on our side';
    details = undefined;
  }
  res.status(status).json({ error: message, details });
};
