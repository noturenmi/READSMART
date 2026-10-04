const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError } = require('../utils/AppError');
const { comparePassword, hashPassword } = require('../utils/password');

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function createAccessToken(user, config) {
  return jwt.sign({ sub: user.id }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
    issuer: 'readsmart-api',
    audience: 'readsmart-mobile',
  });
}

async function registerStudent(input, config) {
  const existingUser = await User.exists({ email: input.email });
  if (existingUser) {
    throw new AppError('An account with this email already exists.', 409, 'EMAIL_IN_USE');
  }

  const passwordHash = await hashPassword(input.password);
  let user;
  try {
    user = await User.create({
      name: input.name,
      email: input.email,
      passwordHash,
      role: 'student',
    });
  } catch (error) {
    // The unique index also handles two simultaneous sign-ups for one email.
    if (error?.code === 11000) {
      throw new AppError('An account with this email already exists.', 409, 'EMAIL_IN_USE');
    }
    throw error;
  }

  return { token: createAccessToken(user, config), user: publicUser(user) };
}

async function login(input, config) {
  const user = await User.findOne({ email: input.email }).select('+passwordHash');
  const passwordMatches = user ? await comparePassword(input.password, user.passwordHash) : false;
  if (!user || !passwordMatches) {
    throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
  }
  return { token: createAccessToken(user, config), user: publicUser(user) };
}

module.exports = { registerStudent, login, publicUser, createAccessToken };
