// Central error handler: Express recognises it because it has FOUR parameters.
// Known AppErrors become clean JSON; anything else is logged and hidden behind a generic 500
// (never leak stack traces or SQL to the client).
const { AppError } = require('../utils/errors');

function notFound(req, res, next) {
  next(new AppError(404, 'NOT_FOUND', `No route for ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, ...err.extra } });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'BAD_JSON', message: 'Request body is not valid JSON' } });
  }
  if (process.env.NODE_ENV !== 'test') console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
}

module.exports = { notFound, errorHandler };
