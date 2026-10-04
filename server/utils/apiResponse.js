function sendSuccess(res, statusCode, data) {
  return res.status(statusCode).json({ success: true, data });
}

function sendError(res, statusCode, message, code, details) {
  const error = { message, code };
  if (details) error.details = details;
  return res.status(statusCode).json({ success: false, error });
}

module.exports = { sendSuccess, sendError };
