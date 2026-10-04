const { AppError } = require('../utils/AppError');
const { sendError } = require('../utils/apiResponse');

function notFound(_req, _res, next) {
  next(new AppError('The requested endpoint was not found.', 404, 'NOT_FOUND'));
}

function errorHandler(error, _req, res, next) {
  if (res.headersSent) return next(error);

  if (error?.type === 'entity.too.large') {
    return sendError(res, 413, 'The request is too large.', 'PAYLOAD_TOO_LARGE');
  }
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return sendError(res, 400, 'The request body must contain valid JSON.', 'INVALID_JSON');
  }
  if (error instanceof AppError) {
    return sendError(res, error.statusCode, error.message, error.code, error.details);
  }
  if (error?.code === 11000) {
    if (error.keyPattern?.email) {
      return sendError(res, 409, 'An account with this email already exists.', 'EMAIL_IN_USE');
    }
    return sendError(res, 409, 'A record with this value already exists.', 'DUPLICATE_RECORD');
  }
  if (error?.name === 'ValidationError') {
    return sendError(res, 400, 'Please check the information you entered.', 'VALIDATION_ERROR');
  }

  console.error('Unhandled API error:', error);
  return sendError(res, 500, 'Something went wrong. Please try again later.', 'INTERNAL_ERROR');
}

module.exports = { notFound, errorHandler };
