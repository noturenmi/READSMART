const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { connectDatabase } = require('../config/database');
const { createApp } = require('../app');
const Lesson = require('../models/Lesson');
const LessonBookmark = require('../models/LessonBookmark');
const Subject = require('../models/Subject');
const User = require('../models/User');
const ActivityRecord = require('../models/ActivityRecord');
const StudentProgress = require('../models/StudentProgress');
const { hashPassword } = require('../utils/password');

const config = {
  jwtSecret: 'bookmark-test-secret-that-is-long-enough',
  jwtExpiresIn: '1h',
  corsOrigins: [],
};

let mongoServer;
let app;
let studentAToken;
let studentBToken;
let adminToken;
let mil;
let ucsp;
let milLesson;
let ucspLesson;
let unpublishedLesson;

function tokenFor(user) {
  return jwt.sign({ sub: user.id }, config.jwtSecret, {
    expiresIn: '1h',
    issuer: 'readsmart-api',
    audience: 'readsmart-mobile',
  });
}

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await connectDatabase(mongoServer.getUri('readsmart_bookmarks_test'));
  app = createApp(config);

  const [studentA, studentB, admin] = await Promise.all([
    User.create({ name: 'Bookmark Student A', email: 'bookmark-a@example.com', passwordHash: await hashPassword('test-password-41'), role: 'student' }),
    User.create({ name: 'Bookmark Student B', email: 'bookmark-b@example.com', passwordHash: await hashPassword('test-password-42'), role: 'student' }),
    User.create({ name: 'Bookmark Admin', email: 'bookmark-admin@example.com', passwordHash: await hashPassword('test-password-43'), role: 'admin' }),
  ]);
  studentAToken = tokenFor(studentA);
  studentBToken = tokenFor(studentB);
  adminToken = tokenFor(admin);

  [mil, ucsp] = await Promise.all([
    Subject.create({ name: 'Media and Information Literacy', code: 'MIL', order: 1 }),
    Subject.create({ name: 'Understanding Culture, Society and Politics', code: 'UCSP', order: 2 }),
  ]);
  [milLesson, ucspLesson, unpublishedLesson] = await Promise.all([
    Lesson.create({ subject: mil._id, title: 'Published MIL lesson', lessonNumber: 1, lesson: 'MIL content', contentStatus: 'ready', isPublished: true }),
    Lesson.create({ subject: ucsp._id, title: 'Published UCSP lesson', lessonNumber: 1, lesson: 'UCSP content', contentStatus: 'ready', isPublished: true }),
    Lesson.create({ subject: mil._id, title: 'Unpublished MIL lesson', lessonNumber: 2, lesson: 'Unpublished content', contentStatus: 'ready', isPublished: false }),
  ]);
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test('bookmark endpoints require authentication and student role', async () => {
  const lessonPath = `/api/bookmarks/${milLesson.id}`;
  assert.equal((await request(app).get('/api/bookmarks')).status, 401);
  assert.equal((await request(app).get(lessonPath)).status, 401);
  assert.equal((await request(app).put(lessonPath)).status, 401);
  assert.equal((await request(app).delete(lessonPath)).status, 401);

  const adminResponse = await request(app).get('/api/bookmarks').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(adminResponse.status, 403);
});

test('students can bookmark and unbookmark only visible valid lessons without duplicate rows', async () => {
  const auth = { Authorization: `Bearer ${studentAToken}` };
  const invalidId = await request(app).put('/api/bookmarks/not-a-lesson').set(auth);
  assert.equal(invalidId.status, 400);
  assert.equal(invalidId.body.error.code, 'INVALID_LESSON_ID');

  const missing = await request(app).put(`/api/bookmarks/${new mongoose.Types.ObjectId()}`).set(auth);
  assert.equal(missing.status, 404);
  const unpublished = await request(app).put(`/api/bookmarks/${unpublishedLesson.id}`).set(auth);
  assert.equal(unpublished.status, 404);

  const [firstSave, repeatedSave] = await Promise.all([
    request(app).put(`/api/bookmarks/${milLesson.id}`).set(auth),
    request(app).put(`/api/bookmarks/${milLesson.id}`).set(auth),
  ]);
  assert.equal(firstSave.status, 200);
  assert.deepEqual(firstSave.body.data.isBookmarked, true);
  assert.equal(repeatedSave.status, 200);
  const studentA = await User.findOne({ email: 'bookmark-a@example.com' });
  assert.equal(await LessonBookmark.countDocuments({ user: studentA._id, lesson: milLesson._id }), 1);
  assert.equal(await ActivityRecord.countDocuments({ user: studentA._id }), 0);
  assert.equal(await StudentProgress.countDocuments({ user: studentA._id }), 0);

  const status = await request(app).get(`/api/bookmarks/${milLesson.id}`).set(auth);
  assert.equal(status.status, 200);
  assert.equal(status.body.data.isBookmarked, true);

  const removed = await request(app).delete(`/api/bookmarks/${milLesson.id}`).set(auth);
  const repeatedRemove = await request(app).delete(`/api/bookmarks/${milLesson.id}`).set(auth);
  assert.equal(removed.status, 200);
  assert.equal(removed.body.data.isBookmarked, false);
  assert.equal(repeatedRemove.status, 200);
  assert.equal((await request(app).get(`/api/bookmarks/${milLesson.id}`).set(auth)).body.data.isBookmarked, false);
});

test('saved lessons persist per account, can be filtered by subject, and omit unpublished records', async () => {
  const authA = { Authorization: `Bearer ${studentAToken}` };
  const authB = { Authorization: `Bearer ${studentBToken}` };
  const studentA = await User.findOne({ email: 'bookmark-a@example.com' });
  const empty = await request(app).get('/api/bookmarks').set(authA);
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.body.data.bookmarks, []);

  await request(app).put(`/api/bookmarks/${milLesson.id}`).set(authA);
  await request(app).put(`/api/bookmarks/${ucspLesson.id}`).set(authA);
  await request(app).put(`/api/bookmarks/${milLesson.id}`).set(authB);
  const forgedOwner = await request(app).put(`/api/bookmarks/${ucspLesson.id}`)
    .set(authB)
    .send({ user: String(studentA._id), studentId: String(studentA._id) });
  assert.equal(forgedOwner.status, 200);
  const removedByB = await request(app).delete(`/api/bookmarks/${ucspLesson.id}`).set(authB);
  assert.equal(removedByB.status, 200);
  assert.equal((await LessonBookmark.countDocuments({ user: studentA._id, lesson: ucspLesson._id })), 1);

  const allA = await request(app).get('/api/bookmarks').set(authA);
  assert.equal(allA.status, 200);
  assert.deepEqual(allA.body.data.bookmarks.map(({ lesson }) => lesson.id).sort(), [milLesson.id, ucspLesson.id].sort());
  assert.ok(allA.body.data.bookmarks.every(({ lesson }) => lesson.subject?.name && lesson.title));

  const milOnly = await request(app).get(`/api/bookmarks?subjectId=${mil.id}`).set(authA);
  assert.equal(milOnly.status, 200);
  assert.deepEqual(milOnly.body.data.bookmarks.map(({ lesson }) => lesson.id), [milLesson.id]);
  const invalidSubject = await request(app).get('/api/bookmarks?subjectId=bad-id').set(authA);
  assert.equal(invalidSubject.status, 400);
  const missingSubject = await request(app).get(`/api/bookmarks?subjectId=${new mongoose.Types.ObjectId()}`).set(authA);
  assert.equal(missingSubject.status, 404);

  const onlyB = await request(app).get('/api/bookmarks').set(authB);
  assert.deepEqual(onlyB.body.data.bookmarks.map(({ lesson }) => lesson.id), [milLesson.id]);
  assert.equal((await request(app).get(`/api/bookmarks/${ucspLesson.id}`).set(authB)).body.data.isBookmarked, false);
  assert.equal((await request(app).get(`/api/bookmarks/${ucspLesson.id}`).set(authA)).body.data.isBookmarked, true);

  await LessonBookmark.create({ user: (await User.findOne({ email: 'bookmark-a@example.com' }))._id, lesson: unpublishedLesson._id });
  const hidesUnpublished = await request(app).get('/api/bookmarks').set(authA);
  assert.equal(hidesUnpublished.body.data.bookmarks.length, 2);
  assert.ok(hidesUnpublished.body.data.bookmarks.every(({ lesson }) => lesson.id !== unpublishedLesson.id));
});
