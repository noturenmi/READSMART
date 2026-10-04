const { AppError } = require('../utils/AppError');

function authorizeRole(...allowedRoles) {
  return function roleAuthorizer(req, _res, next) {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to access this resource.', 403, 'FORBIDDEN'));
    }
    return next();
  };
}

module.exports = { authorizeRole };
