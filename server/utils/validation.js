const { AppError } = require('./AppError');

function validateBody(schema) {
  return function bodyValidator(req, res, next) {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      return next(new AppError('Please check the information you entered.', 400, 'VALIDATION_ERROR', details));
    }
    req.validatedBody = result.data;
    return next();
  };
}

module.exports = { validateBody };
