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
const { applyMilContentImport } = require('../seed/importMilContent');
const { applyUcspContentImport } = require('../seed/importUcspContent');
const { applyCparContentImport } = require('../seed/importCparContent');
const cparLessons = require('../seed/cparLessons.json');

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
  await connectDatabase(mongoServer.getUri('readsmart_cpar_import_test'));
  await applyReadingSeed();
  await applyMilContentImport();
  await applyUcspContentImport();
  app = createApp(config);
  const student = await User.create({
    name: 'CPAR Test Student',
    email: 'cpar-test@example.com',
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

test('CPAR import is idempotent, preserves IDs and existing subject publication states', async () => {
  const cpar = await Subject.findOne({ code: 'CPAR' });
  const originalIds = new Map(
    (await Lesson.find({ subject: cpar._id }).select('_id lessonNumber').lean())
      .map(({ _id, lessonNumber }) => [lessonNumber, String(_id)]),
  );
  const first = await applyCparContentImport();

  await applyReadingSeed();
  const second = await applyCparContentImport();
  assert.equal(first.subjectCount, 4);
  assert.equal(first.totalLessonCount, 40);
  assert.deepEqual(second.counts, first.counts);
  assert.equal(await Subject.countDocuments(), 4);
  assert.equal(await Subject.countDocuments({ code: 'CPAR' }), 1);
  assert.equal(await Lesson.countDocuments(), 40);

  const cparRecords = await Lesson.find({ subject: cpar._id }).sort({ lessonNumber: 1 }).lean();
  assert.equal(cparRecords.length, 10);
  for (const [index, record] of cparRecords.entries()) {
    const supplied = cparLessons[index];
    assert.equal(record.lessonNumber, index + 1);
    assert.equal(String(record._id), originalIds.get(index + 1));
    assert.equal(record.overview, '');
    for (const field of ['title', 'overview', 'lesson', 'discussion', 'example', 'keyTakeaway']) {
      assert.equal(record[field], supplied[field], `CPAR ${field} must match the supplied lesson ${index + 1}.`);
    }
    assert.deepEqual(record.keyConcepts, supplied.keyConcepts);
    assert.ok(record.isPublished && record.contentStatus === 'ready');
  }
  assert.ok(cparRecords.every(({ keyConcepts }) => keyConcepts.every((concept) => !/^[-*•]\s/.test(concept))));

  const mil = await Subject.findOne({ code: 'MIL' });
  const ucsp = await Subject.findOne({ code: 'UCSP' });
  const els = await Subject.findOne({ code: 'ELS' });
  for (const subject of [mil, ucsp]) {
    const records = await Lesson.find({ subject: subject._id });
    assert.equal(records.length, 10);
    assert.ok(records.every(({ isPublished, contentStatus }) => isPublished && contentStatus === 'ready'));
  }
  const elsRecords = await Lesson.find({ subject: els._id });
  assert.equal(elsRecords.length, 10);
  assert.ok(elsRecords.every(({ isPublished, contentStatus }) => !isPublished && contentStatus === 'pending'));

  const duplicates = await Lesson.aggregate([
    { $group: { _id: { subject: '$subject', lessonNumber: '$lessonNumber' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);
  assert.equal(duplicates.length, 0);
});

test('authenticated student sees published CPAR lessons and not unpublished ELS lessons', async () => {
  const auth = { Authorization: `Bearer ${studentToken}` };
  assert.equal((await request(app).get('/api/subjects')).status, 401);

  const subjectResponse = await request(app).get('/api/subjects').set(auth);
  assert.equal(subjectResponse.status, 200);
  const cparSummary = subjectResponse.body.data.subjects.find(({ code }) => code === 'CPAR');
  assert.ok(cparSummary);
  assert.equal(cparSummary.availableLessonCount, 10);

  const cpar = await Subject.findOne({ code: 'CPAR' });
  const subjectDetail = await request(app).get(`/api/subjects/${cpar.id}`).set(auth);
  assert.equal(subjectDetail.status, 200);
  assert.equal(subjectDetail.body.data.subject.name, 'Contemporary Philippine Arts from the Regions');

  const list = await request(app).get(`/api/subjects/${cpar.id}/lessons`).set(auth);
  assert.equal(list.status, 200);
  assert.equal(list.body.data.lessons.length, 10);
  assert.deepEqual(list.body.data.lessons.map(({ lessonNumber }) => lessonNumber), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(list.body.data.lessons.map(({ title }) => title), cparLessons.map(({ title }) => title));

  const first = await Lesson.findOne({ subject: cpar._id, lessonNumber: 1 });
  const detail = await request(app).get(`/api/lessons/${first.id}`).set(auth);
  assert.equal(detail.status, 200);
  const body = detail.body.data.lesson;
  assert.equal(body.title, cparLessons[0].title);
  for (const field of ['lesson', 'discussion', 'example', 'keyTakeaway']) assert.ok(body[field].length > 0);
  assert.ok(body.keyConcepts.length > 0);

  const els = await Subject.findOne({ code: 'ELS' });
  const elsList = await request(app).get(`/api/subjects/${els.id}/lessons`).set(auth);
  assert.equal(elsList.status, 200);
  assert.deepEqual(elsList.body.data.lessons, []);

  assert.equal((await request(app).get('/api/subjects/not-an-id').set(auth)).status, 400);
  assert.equal((await request(app).get('/api/lessons/not-an-id').set(auth)).status, 400);
});
