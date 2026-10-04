const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { connectDatabase } = require('../config/database');
const { createApp } = require('../app');
const Lesson = require('../models/Lesson');
const Subject = require('../models/Subject');
const User = require('../models/User');
const { hashPassword } = require('../utils/password');
const { applyReadingSeed } = require('../seed/seedReadingData');

const config = {
  jwtSecret: 'test-secret-that-is-long-enough-for-jwt-testing',
  jwtExpiresIn: '1h',
  corsOrigins: [],
};

let mongoServer;
let app;
let studentToken;

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await connectDatabase(mongoServer.getUri('readsmart_reading_test'));
  app = createApp(config);
  const student = await User.create({
    name: 'Reading Test Student',
    email: 'reading-test@example.com',
    passwordHash: await hashPassword('test-password-41'),
    role: 'student',
  });
  studentToken = jwt.sign({ sub: student.id }, config.jwtSecret, {
    expiresIn: '1h',
    issuer: 'readsmart-api',
    audience: 'readsmart-mobile',
  });
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test('reading seed creates the catalog idempotently without inventing lesson bodies', async () => {
  const first = await applyReadingSeed();
  const second = await applyReadingSeed();
  assert.deepEqual(first, { subjectCount: 4, lessonCount: 40, pendingCount: 40 });
  assert.deepEqual(second, first);
  assert.equal(await Subject.countDocuments(), 4);
  assert.equal(await Lesson.countDocuments(), 40);
  assert.equal(await Lesson.countDocuments({ contentStatus: 'pending', isPublished: false }), 40);
  const lesson = await Lesson.findOne({ lessonNumber: 1 }).lean();
  assert.equal(lesson.lesson, '');
  assert.equal(lesson.discussion, '');
  assert.deepEqual(lesson.keyConcepts, []);
});

test('reading routes require authentication and return subjects in catalog order', async () => {
  for (const path of ['/api/subjects', `/api/subjects/${new mongoose.Types.ObjectId()}`, `/api/subjects/${new mongoose.Types.ObjectId()}/lessons`, `/api/lessons/${new mongoose.Types.ObjectId()}`]) {
    const response = await request(app).get(path);
    assert.equal(response.status, 401, `${path} should reject unauthenticated requests`);
  }

  const response = await request(app).get('/api/subjects').set('Authorization', `Bearer ${studentToken}`);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.subjects.map(({ code }) => code), ['MIL', 'UCSP', 'CPAR', 'ELS']);
  assert.equal(response.body.data.subjects[0].plannedLessonCount, 10);
  assert.equal(response.body.data.subjects[0].availableLessonCount, 0);
});

test('student can request a subject, ordered published lessons, and published lesson detail only', async () => {
  const mil = await Subject.findOne({ code: 'MIL' });
  const first = await Lesson.findOne({ subject: mil._id, lessonNumber: 1 });
  const second = await Lesson.findOne({ subject: mil._id, lessonNumber: 2 });
  const tenth = await Lesson.findOne({ subject: mil._id, lessonNumber: 10 });

  Object.assign(first, {
    contentStatus: 'ready', isPublished: true, overview: 'Synthetic test overview',
    lesson: 'Synthetic test introduction', discussion: 'Synthetic test discussion',
    example: 'Synthetic test example', keyConcepts: ['Synthetic concept'], keyTakeaway: 'Synthetic test takeaway',
  });
  Object.assign(second, { contentStatus: 'ready', isPublished: false, lesson: 'Hidden test content' });
  Object.assign(tenth, { contentStatus: 'ready', isPublished: true, lesson: 'Synthetic later lesson' });
  await Promise.all([first.save(), second.save(), tenth.save()]);

  const subjectResponse = await request(app)
    .get(`/api/subjects/${mil.id}`)
    .set('Authorization', `Bearer ${studentToken}`);
  assert.equal(subjectResponse.status, 200);
  assert.equal(subjectResponse.body.data.subject.name, 'Media and Information Literacy');
  assert.equal(subjectResponse.body.data.subject.availableLessonCount, 2);

  const listResponse = await request(app)
    .get(`/api/subjects/${mil.id}/lessons`)
    .set('Authorization', `Bearer ${studentToken}`);
  assert.equal(listResponse.status, 200);
  assert.deepEqual(listResponse.body.data.lessons.map(({ lessonNumber }) => lessonNumber), [1, 10]);
  assert.equal(JSON.stringify(listResponse.body).includes('Hidden test content'), false);

  const detailResponse = await request(app)
    .get(`/api/lessons/${first.id}`)
    .set('Authorization', `Bearer ${studentToken}`);
  assert.equal(detailResponse.status, 200);
  assert.equal(detailResponse.body.data.lesson.lesson, 'Synthetic test introduction');
  assert.deepEqual(detailResponse.body.data.lesson.keyConcepts, ['Synthetic concept']);
  assert.equal(detailResponse.body.data.lesson.subject.code, 'MIL');

  const unpublishedResponse = await request(app)
    .get(`/api/lessons/${second.id}`)
    .set('Authorization', `Bearer ${studentToken}`);
  assert.equal(unpublishedResponse.status, 404);
  const pending = await Lesson.findOne({ subject: mil._id, lessonNumber: 3 });
  const pendingResponse = await request(app)
    .get(`/api/lessons/${pending.id}`)
    .set('Authorization', `Bearer ${studentToken}`);
  assert.equal(pendingResponse.status, 404);

  await applyReadingSeed();
  assert.equal((await Lesson.findById(first.id)).lesson, 'Synthetic test introduction');
});

test('invalid and missing subject and lesson IDs return safe client errors', async () => {
  const auth = { Authorization: `Bearer ${studentToken}` };
  const invalidSubject = await request(app).get('/api/subjects/not-an-id').set(auth);
  assert.equal(invalidSubject.status, 400);
  assert.equal(invalidSubject.body.error.code, 'INVALID_SUBJECT_ID');

  const missingSubject = await request(app)
    .get(`/api/subjects/${new mongoose.Types.ObjectId()}`)
    .set(auth);
  assert.equal(missingSubject.status, 404);

  const invalidLesson = await request(app).get('/api/lessons/bad-id').set(auth);
  assert.equal(invalidLesson.status, 400);
  assert.equal(invalidLesson.body.error.code, 'INVALID_LESSON_ID');

  const missingLesson = await request(app)
    .get(`/api/lessons/${new mongoose.Types.ObjectId()}`)
    .set(auth);
  assert.equal(missingLesson.status, 404);
});
