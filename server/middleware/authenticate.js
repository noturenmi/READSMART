const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError } = require('../utils/AppError');
const { asyncHandler } = require('../utils/asyncHandler');

function createAuthenticate(config) {
  return asyncHandler(async (req, _res, next) => {
    const authorization = req.get('authorization') || '';
    const [scheme, token] = authorization.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new AppError('Please sign in to continue.', 401, 'AUTHENTICATION_REQUIRED');
    }

    let claims;
    try {
      claims = jwt.verify(token, config.jwtSecret, {
        issuer: 'readsmart-api',
        audience: 'readsmart-mobile',
      });
    } catch {
      throw new AppError('Your session is invalid or has expired. Please sign in again.', 401, 'INVALID_TOKEN');
    }

    const user = await User.findById(claims.sub);
    if (!user) {
      throw new AppError('Your account could not be found. Please sign in again.', 401, 'INVALID_TOKEN');
    }
    req.user = user;
    return next();
  });
}

module.exports = { createAuthenticate };
