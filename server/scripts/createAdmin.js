const { getConfig } = require('../config/env');
const { connectDatabase } = require('../config/database');
const User = require('../models/User');
const { hashPassword, passwordByteLength } = require('../utils/password');

async function createAdmin() {
  const config = getConfig();
  const name = (process.env.ADMIN_NAME || '').trim();
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';

  if (!name || !email || !password) {
    throw new Error('Set ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD in server/.env before creating an admin.');
  }
  if (name.length < 2 || name.length > 80) throw new Error('ADMIN_NAME must be 2 to 80 characters.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('ADMIN_EMAIL must be a valid email address.');
  if (password.length < 12 || passwordByteLength(password) > 72) {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters and at most 72 UTF-8 bytes.');
  }

  await connectDatabase(config.mongoUri);
  const existingUser = await User.findOne({ email });
  if (existingUser && existingUser.role !== 'admin') {
    throw new Error('This email already belongs to a student. Choose a different admin email.');
  }

  const passwordHash = await hashPassword(password);
  if (existingUser) {
    existingUser.name = name;
    existingUser.passwordHash = passwordHash;
    await existingUser.save();
    console.log(`Administrator credentials updated for ${email}.`);
  } else {
    await User.create({ name, email, passwordHash, role: 'admin' });
    console.log(`Administrator account created for ${email}.`);
  }
}

createAdmin()
  .catch((error) => {
    console.error(`Could not create administrator: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    const mongoose = require('mongoose');
    await mongoose.disconnect();
  });
