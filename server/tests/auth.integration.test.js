const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { connectDatabase } = require('../config/database');
const { createApp } = require('../app');
const { startServer } = require('../server');
const User = require('../models/User');
const { hashPassword } = require('../utils/password');

const config = {
  jwtSecret: 'test-secret-that-is-long-enough-for-jwt-testing',
  jwtExpiresIn: '1h',
  corsOrigins: [],
};

let mongoServer;
let app;

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await connectDatabase(mongoServer.getUri('readsmart_test'));
  await User.init();
  app = createApp(config);
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test('registration, login, profile, protected routes, and role authorization', async () => {
  const missingField = await request(app)
    .post('/api/auth/register')
    .send({ email: 'student@example.com', password: 'reading-pass-42' });
  assert.equal(missingField.status, 400);
  assert.equal(missingField.body.error.code, 'VALIDATION_ERROR');

  const invalidEmail = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Student Reader', email: 'not-an-email', password: 'reading-pass-42' });
  assert.equal(invalidEmail.status, 400);

  const roleEscalation = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Student Reader', email: 'attacker@example.com', password: 'reading-pass-42', role: 'admin' });
  assert.equal(roleEscalation.status, 400);
  assert.equal(await User.exists({ email: 'attacker@example.com' }), null);

  const registration = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Student Reader', email: 'Student@Example.com', password: 'reading-pass-42' });
  assert.equal(registration.status, 201);
  assert.equal(registration.body.success, true);
  assert.equal(registration.body.data.user.email, 'student@example.com');
  assert.equal(registration.body.data.user.role, 'student');
  assert.equal('passwordHash' in registration.body.data.user, false);
  const studentToken = registration.body.data.token;

  const storedStudent = await User.findOne({ email: 'student@example.com' }).select('+passwordHash');
  assert.ok(storedStudent.passwordHash);
  assert.notEqual(storedStudent.passwordHash, 'reading-pass-42');

  const duplicate = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Student Reader', email: 'student@example.com', password: 'reading-pass-42' });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error.code, 'EMAIL_IN_USE');

  const wrongPassword = await request(app)
    .post('/api/auth/login')
    .send({ email: 'student@example.com', password: 'wrong-password' });
  assert.equal(wrongPassword.status, 401);
  assert.equal(wrongPassword.body.error.code, 'INVALID_CREDENTIALS');

  const unauthenticatedMe = await request(app).get('/api/auth/me');
  assert.equal(unauthenticatedMe.status, 401);
  const unauthenticatedProtected = await request(app).get('/api/test/protected');
  assert.equal(unauthenticatedProtected.status, 401);

  const studentLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'STUDENT@example.com', password: 'reading-pass-42' });
  assert.equal(studentLogin.status, 200);
  assert.equal(studentLogin.body.data.user.role, 'student');

  const studentMe = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${studentToken}`);
  assert.equal(studentMe.status, 200);
  assert.equal(studentMe.body.data.user.email, 'student@example.com');
  assert.equal('passwordHash' in studentMe.body.data.user, false);

  const studentProtected = await request(app)
    .get('/api/test/protected')
    .set('Authorization', `Bearer ${studentToken}`);
  assert.equal(studentProtected.status, 200);

  const studentAdminDenied = await request(app)
    .get('/api/admin/test')
    .set('Authorization', `Bearer ${studentToken}`);
  assert.equal(studentAdminDenied.status, 403);
  assert.equal(studentAdminDenied.body.error.code, 'FORBIDDEN');

  const expiredToken = jwt.sign({ sub: storedStudent.id }, config.jwtSecret, {
    expiresIn: -1,
    issuer: 'readsmart-api',
    audience: 'readsmart-mobile',
  });
  const expiredRequest = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${expiredToken}`);
  assert.equal(expiredRequest.status, 401);
  assert.equal(expiredRequest.body.error.code, 'INVALID_TOKEN');

  const administrator = await User.create({
    name: 'READSMART Administrator',
    email: 'admin@example.com',
    passwordHash: await hashPassword('admin-long-password-91'),
    role: 'admin',
  });
  assert.ok(administrator.id);

  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@example.com', password: 'admin-long-password-91' });
  assert.equal(adminLogin.status, 200);
  assert.equal(adminLogin.body.data.user.role, 'admin');

  const adminAllowed = await request(app)
    .get('/api/admin/test')
    .set('Authorization', `Bearer ${adminLogin.body.data.token}`);
  assert.equal(adminAllowed.status, 200);
  assert.equal(adminAllowed.body.data.message, 'Administrator authorization succeeded.');

  // Exercise the real server entry point and listener, not only Supertest's app harness.
  await mongoose.disconnect();
  const listeningServer = await startServer({
    ...config,
    mongoUri: mongoServer.getUri('readsmart_test'),
    port: 0,
  });
  try {
    const port = listeningServer.address().port;
    const runningResponse = await fetch(`http://127.0.0.1:${port}/api/admin/test`, {
      headers: { Authorization: `Bearer ${adminLogin.body.data.token}` },
    });
    assert.equal(runningResponse.status, 200);
    assert.equal((await runningResponse.json()).success, true);
  } finally {
    await new Promise((resolve, reject) => {
      listeningServer.close((error) => (error ? reject(error) : resolve()));
    });
    await mongoose.disconnect();
  }
});
