const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = 12;

function passwordByteLength(password) {
  return Buffer.byteLength(password, 'utf8');
}

async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function comparePassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

module.exports = { hashPassword, comparePassword, passwordByteLength };
