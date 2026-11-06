const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { connectDatabase } = require('../config/database');
const { createApp } = require('../app');
const Subject = require('../models/Subject');
const User = require('../models/User');

const config = {
  jwtSecret: 'test-secret-that-is-long-enough-for-subject-code-tests',
  jwtExpiresIn: '1h',
  corsOrigins: [],
};

let mongoServer;
let app;
let token;

function asAdmin(req) {
  return req.set({ Authorization: `Bearer ${token}` });
}

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await connectDatabase(mongoServer.getUri('readsmart_subject_code_test'));
  await Promise.all([User.init(), Subject.init()]);
  app = createApp(config);

  const admin = await User.create({
    name: 'Subject Code Test Admin',
    email: 'subject-code-admin@example.com',
    passwordHash: 'test-hash',
    role: 'admin',
  });
  token = jwt.sign({ sub: String(admin._id) }, config.jwtSecret, {
    expiresIn: '1h', issuer: 'readsmart-api', audience: 'readsmart-mobile',
  });
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test('admin subject codes accept existing and hyphenated codes and normalize lowercase input', async () => {
  const validCodes = ['MIL', 'UCSP', 'CPAR', 'ELS', 'E-TECH', 'CPAR-1'];
  for (const [index, code] of validCodes.entries()) {
    const response = await asAdmin(request(app).post('/api/admin/subjects').send({
      name: `Subject ${index + 1} ${code}`,
      code,
      description: '',
      order: index + 1,
    }));
    assert.equal(response.status, 201, `Expected ${code} to be accepted.`);
    assert.equal(response.body.data.subject.code, code);
  }

  const lowercase = await asAdmin(request(app).post('/api/admin/subjects').send({
    name: 'Lowercase Entry', code: 'new-code', description: '', order: 7,
  }));
  assert.equal(lowercase.status, 201);
  assert.equal(lowercase.body.data.subject.code, 'NEW-CODE');

  const edit = await asAdmin(request(app).put(`/api/admin/subjects/${lowercase.body.data.subject.id}`).send({ code: 'CPAR-1A' }));
  assert.equal(edit.status, 200);
  assert.equal(edit.body.data.subject.code, 'CPAR-1A');
});

test('admin subject code validation rejects empty, malformed, and overlength codes with a code-specific error', async () => {
  const invalidCodes = ['', 'A', '-TECH', 'TECH-', 'E--TECH', 'E_TECH', 'E TECH', 'A'.repeat(17)];
  for (const [index, code] of invalidCodes.entries()) {
    const response = await asAdmin(request(app).post('/api/admin/subjects').send({
      name: `Invalid Subject ${index}`,
      code,
      description: '',
      order: index + 20,
    }));
    assert.equal(response.status, 400, `Expected ${JSON.stringify(code)} to be rejected.`);
    assert.ok(response.body.error.details.some((detail) => detail.field === 'code'));
  }

  const invalidModel = new Subject({ name: 'Invalid Model Subject', code: 'E--TECH', order: 99 });
  await assert.rejects(invalidModel.validate(), /hyphens only between code parts/);
});
