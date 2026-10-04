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
const { applyElsContentImport } = require('../seed/importElsContent');
const elsLessons = require('../seed/earthLifeScienceLessons.json');

const config = {
  jwtSecret: 'test-secret-that-is-long-enough-for-jwt-testing',
  jwtExpiresIn: '1h',
  corsOrigins: [],
};

let mongoServer;
let app;
let studentToken;
let previousContent;

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await connectDatabase(mongoServer.getUri('readsmart_els_import_test'));
  await applyReadingSeed();
  await applyMilContentImport();
  await applyUcspContentImport();
  await applyCparContentImport();

  previousContent = {};
  for (const code of ['MIL', 'UCSP', 'CPAR']) {
    const subject = await Subject.findOne({ code });
    previousContent[code] = await Lesson.find({ subject: subject._id }).sort({ lessonNumber: 1 }).lean();
  }

  app = createApp(config);
  const student = await User.create({
    name: 'ELS Test Student',
    email: 'els-test@example.com',
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

test('ELS import is idempotent, preserves lesson IDs and prior subjects, and publishes all 40 lessons', async () => {
  const els = await Subject.findOne({ code: 'ELS' });
  const originalIds = new Map(
    (await Lesson.find({ subject: els._id }).select('_id lessonNumber').lean())
      .map(({ _id, lessonNumber }) => [lessonNumber, String(_id)]),
  );
  await applyElsContentImport();
  await Lesson.updateMany(
    { subject: els._id, lessonNumber: { $in: [9, 10] } },
    { $set: { discussion: '' } },
  );
  const beforeUpdate = await Lesson.find({ subject: els._id }).sort({ lessonNumber: 1 }).lean();
  const first = await applyElsContentImport();

  const firstPass = await Lesson.find({ subject: els._id }).sort({ lessonNumber: 1 }).lean();
  for (const [index, record] of firstPass.entries()) {
    const before = beforeUpdate[index];
    assert.equal(String(record._id), String(before._id));
    for (const field of ['title', 'overview', 'lesson', 'example', 'keyConcepts', 'keyTakeaway', 'isPublished', 'contentStatus']) {
      assert.deepEqual(record[field], before[field], `ELS ${field} must remain unchanged for lesson ${index + 1}.`);
    }
    if ([9, 10].includes(record.lessonNumber)) assert.ok(record.discussion.trim());
    else assert.equal(record.discussion, before.discussion);
  }

  await applyReadingSeed();
  const second = await applyElsContentImport();
  assert.equal(first.subjectCount, 4);
  assert.equal(first.totalLessonCount, 40);
  assert.deepEqual(second.counts, first.counts);
  assert.equal(await Subject.countDocuments(), 4);
  assert.equal(await Subject.countDocuments({ code: 'ELS' }), 1);
  assert.equal(await Lesson.countDocuments(), 40);

  const elsRecords = await Lesson.find({ subject: els._id }).sort({ lessonNumber: 1 }).lean();
  assert.equal(elsRecords.length, 10);
  for (const [index, record] of elsRecords.entries()) {
    const supplied = elsLessons[index];
    assert.equal(record.lessonNumber, index + 1);
    assert.equal(String(record._id), originalIds.get(index + 1));
    for (const field of ['title', 'overview', 'lesson', 'discussion', 'example', 'keyTakeaway']) {
      assert.equal(record[field], supplied[field], `ELS ${field} must match supplied lesson ${index + 1}.`);
    }
    assert.deepEqual(record.keyConcepts, supplied.keyConcepts);
    assert.ok(record.isPublished && record.contentStatus === 'ready');
  }

  for (const code of ['MIL', 'UCSP', 'CPAR']) {
    const subject = await Subject.findOne({ code });
    const records = await Lesson.find({ subject: subject._id }).sort({ lessonNumber: 1 }).lean();
    assert.equal(records.length, 10);
    assert.ok(records.every(({ isPublished, contentStatus }) => isPublished && contentStatus === 'ready'));
    assert.deepEqual(records.map(({ title, lesson, discussion, example, keyConcepts, keyTakeaway }) => ({
      title, lesson, discussion, example, keyConcepts, keyTakeaway,
    })), previousContent[code].map(({ title, lesson, discussion, example, keyConcepts, keyTakeaway }) => ({
      title, lesson, discussion, example, keyConcepts, keyTakeaway,
    })));
  }

  const duplicates = await Lesson.aggregate([
    { $group: { _id: { subject: '$subject', lessonNumber: '$lessonNumber' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);
  assert.equal(duplicates.length, 0);
});

test('authenticated reading APIs return ELS content and keep all subjects available', async () => {
  const auth = { Authorization: `Bearer ${studentToken}` };
  assert.equal((await request(app).get('/api/subjects')).status, 401);

  const subjectResponse = await request(app).get('/api/subjects').set(auth);
  assert.equal(subjectResponse.status, 200);
  const subjects = subjectResponse.body.data.subjects;
  assert.deepEqual(subjects.map(({ code }) => code), ['MIL', 'UCSP', 'CPAR', 'ELS']);
  assert.ok(subjects.every(({ availableLessonCount }) => availableLessonCount === 10));

  const els = await Subject.findOne({ code: 'ELS' });
  const subjectDetail = await request(app).get(`/api/subjects/${els.id}`).set(auth);
  assert.equal(subjectDetail.status, 200);
  assert.equal(subjectDetail.body.data.subject.name, 'Earth and Life Science');

  const list = await request(app).get(`/api/subjects/${els.id}/lessons`).set(auth);
  assert.equal(list.status, 200);
  assert.equal(list.body.data.lessons.length, 10);
  assert.deepEqual(list.body.data.lessons.map(({ lessonNumber }) => lessonNumber), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(list.body.data.lessons.map(({ title }) => title), elsLessons.map(({ title }) => title));

  for (const lessonNumber of [1, 9, 10]) {
    const supplied = elsLessons[lessonNumber - 1];
    const response = await request(app).get(`/api/lessons/${list.body.data.lessons[lessonNumber - 1].id}`).set(auth);
    assert.equal(response.status, 200);
    const body = response.body.data.lesson;
    assert.equal(body.title, supplied.title);
    for (const field of ['lesson', 'discussion', 'example', 'keyTakeaway']) assert.equal(body[field], supplied[field]);
    assert.deepEqual(body.keyConcepts, supplied.keyConcepts);
  }

  for (const code of ['MIL', 'UCSP', 'CPAR']) {
    const subject = await Subject.findOne({ code });
    const response = await request(app).get(`/api/subjects/${subject.id}/lessons`).set(auth);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.lessons.length, 10);
    const record = await Lesson.findOne({ subject: subject._id, lessonNumber: 1 });
    const detail = await request(app).get(`/api/lessons/${record.id}`).set(auth);
    assert.equal(detail.status, 200);
  }
});
