const { HttpError } = require('../utils/httpError');

const notFound = (req, _res, next) => {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

const errorHandler = (error, _req, res, _next) => {
  const statusCode = error instanceof HttpError ? error.statusCode : 500;
  const message = error instanceof HttpError ? error.message : 'Internal server error';

  if (statusCode >= 500) {
    console.error('[API Error]', error);
  }

  res.status(statusCode).json({ message });
};

module.exports = { errorHandler, notFound };
