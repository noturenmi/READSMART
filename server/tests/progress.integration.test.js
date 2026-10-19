const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { connectDatabase } = require('../config/database');
const { createApp } = require('../app');
const ActivityRecord = require('../models/ActivityRecord');
const Lesson = require('../models/Lesson');
const ReadingQuestion = require('../models/ReadingQuestion');
const StudentProgress = require('../models/StudentProgress');
const Subject = require('../models/Subject');
const User = require('../models/User');
const WritingActivity = require('../models/WritingActivity');
const WritingSubmission = require('../models/WritingSubmission');
const { applyReadingSeed } = require('../seed/seedReadingData');
const { applyMilContentImport } = require('../seed/importMilContent');
const { applyUcspContentImport } = require('../seed/importUcspContent');
const { applyCparContentImport } = require('../seed/importCparContent');
const { applyElsContentImport } = require('../seed/importElsContent');
const { applyAssessmentSeed } = require('../seed/seedAssessmentData');
const { applyWritingSeed } = require('../seed/seedWritingActivities');
const { calculateLevel } = require('../services/progressService');

const config = {
  jwtSecret: 'test-secret-that-is-long-enough-for-progress-tests',
  jwtExpiresIn: '1h',
  corsOrigins: [],
};

let mongoServer;
let app;
let studentA;
let studentB;
let tokenA;
let tokenB;
let subjects;
let milLessons;
let writingActivity;

function createToken(user) {
  return jwt.sign({ sub: user.id }, config.jwtSecret, {
    expiresIn: '1h',
    issuer: 'readsmart-api',
    audience: 'readsmart-mobile',
  });
}

async function submitReading(lesson) {
  const questions = await ReadingQuestion.find({ lesson: lesson._id, isPublished: true }).sort({ order: 1 }).lean();
  const response = await request(app)
    .post(`/api/lessons/${lesson._id}/assessment`)
    .set({ Authorization: `Bearer ${tokenA}` })
    .send({ answers: questions.map((question) => ({ questionId: String(question._id), selectedAnswer: 0 })) });
  assert.equal(response.status, 201);
  return response.body.data;
}

const writingResponse = Array.from({ length: 10 }, (_value, index) => (
  `Students can examine the lesson ideas and connect each example with the topic number ${index}.`
)).join(' ');

async function submitWriting() {
  return request(app)
    .post(`/api/lessons/${milLessons[0]._id}/writing`)
    .set({ Authorization: `Bearer ${tokenA}` })
    .send({ writingActivityId: String(writingActivity._id), response: writingResponse });
}

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await connectDatabase(mongoServer.getUri('readsmart_progress_test'));
  await applyReadingSeed();
  await applyMilContentImport();
  await applyUcspContentImport();
  await applyCparContentImport();
  await applyElsContentImport();
  await applyAssessmentSeed();
  await applyWritingSeed();
  app = createApp(config);
  studentA = await User.create({ name: 'Progress Student A', email: 'progress-a@example.com', passwordHash: 'test-hash', role: 'student' });
  studentB = await User.create({ name: 'Progress Student B', email: 'progress-b@example.com', passwordHash: 'test-hash', role: 'student' });
  tokenA = createToken(studentA);
  tokenB = createToken(studentB);
  subjects = await Subject.find({ isActive: true }).sort({ order: 1 }).lean();
  const mil = subjects.find(({ code }) => code === 'MIL');
  milLessons = await Lesson.find({ subject: mil._id, isPublished: true, contentStatus: 'ready' }).sort({ lessonNumber: 1 }).lean();
  writingActivity = await WritingActivity.findOne({ lesson: milLessons[0]._id, isPublished: true });
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test('level formula is deterministic and progress endpoints require authentication', async () => {
  assert.equal(calculateLevel(0), 1);
  assert.equal(calculateLevel(99), 1);
  assert.equal(calculateLevel(100), 2);
  assert.equal(calculateLevel(299), 3);
  assert.equal(calculateLevel(300), 4);

  assert.equal((await request(app).get('/api/progress/me')).status, 401);
  assert.equal((await request(app).get('/api/progress/subjects')).status, 401);
});

test('authenticated student progress is initialized from the real catalog and private to the student', async () => {
  const initial = await request(app).get('/api/progress/me').set({ Authorization: `Bearer ${tokenA}` });
  assert.equal(initial.status, 200);
  assert.equal(initial.body.data.totalXP, 0);
  assert.equal(initial.body.data.level, 1);
  assert.equal(initial.body.data.readingAssessmentsCompleted, 0);
  assert.equal(initial.body.data.totalReadingAssessments, 40);
  assert.equal(initial.body.data.writingActivitiesCompleted, 0);
  assert.equal(initial.body.data.totalWritingActivities, 40);
  assert.equal(initial.body.data.lessonsCompleted, 0);
  assert.equal(initial.body.data.totalLessons, 40);
  assert.equal(initial.body.data.overallProgressPercentage, 0);
  assert.equal(await StudentProgress.countDocuments({ user: studentA._id }), 1);

  const subjectResult = await request(app).get('/api/progress/subjects').set({ Authorization: `Bearer ${tokenA}` });
  assert.equal(subjectResult.status, 200);
  assert.equal(subjectResult.body.data.subjects.length, 4);
  assert.ok(subjectResult.body.data.subjects.every((subject) => subject.totalLessons === 10 && subject.completedLessons === 0));
  assert.ok(subjectResult.body.data.subjects.every((subject) => (
    subject.completedReadingAssessments === 0
    && subject.totalReadingAssessments === 10
    && subject.completedWritingActivities === 0
    && subject.totalWritingActivities === 10
    && subject.totalXP === 0
  )));

  const otherStudent = await request(app).get(`/api/progress/me?userId=${studentA.id}`).set({ Authorization: `Bearer ${tokenB}` });
  assert.equal(otherStudent.status, 200);
  assert.equal(otherStudent.body.data.totalXP, 0);
  assert.equal(otherStudent.body.data.level, 1);
  assert.equal(Object.hasOwn(otherStudent.body.data, 'user'), false);
  assert.equal(await StudentProgress.countDocuments({ user: studentB._id }), 1);
});

test('reading and writing completions award XP once and progress counts unique activities', async () => {
  const firstReading = await submitReading(milLessons[0]);
  assert.equal(firstReading.attemptId.length, 24);
  assert.equal(await ActivityRecord.countDocuments({ user: studentA._id, activityType: 'reading_assessment', lesson: milLessons[0]._id }), 1);
  assert.equal((await ActivityRecord.findOne({ user: studentA._id, activityType: 'reading_assessment', lesson: milLessons[0]._id })).xpEarned, 20);

  const repeatedReading = await submitReading(milLessons[0]);
  assert.ok(repeatedReading.attemptId);
  assert.equal(await ActivityRecord.countDocuments({ user: studentA._id, activityType: 'reading_assessment', lesson: milLessons[0]._id }), 1);
  const attempts = await request(app)
    .get(`/api/lessons/${milLessons[0]._id}/assessment-attempts`)
    .set({ Authorization: `Bearer ${tokenA}` });
  assert.equal(attempts.status, 200);
  assert.equal(attempts.body.data.attempts.length, 2);

  const firstWriting = await submitWriting();
  assert.equal(firstWriting.status, 201);
  const repeatedWriting = await submitWriting();
  assert.equal(repeatedWriting.status, 201);
  assert.equal(await WritingSubmission.countDocuments({ user: studentA._id, lesson: milLessons[0]._id }), 2);
  assert.equal(await ActivityRecord.countDocuments({ user: studentA._id, activityType: 'writing_activity', lesson: milLessons[0]._id }), 1);
  assert.equal((await ActivityRecord.findOne({ user: studentA._id, activityType: 'writing_activity', lesson: milLessons[0]._id })).xpEarned, 25);

  await submitReading(milLessons[1]);
  await submitReading(milLessons[2]);
  await submitReading(milLessons[3]);

  const progressResponse = await request(app).get('/api/progress/me').set({ Authorization: `Bearer ${tokenA}` });
  assert.equal(progressResponse.status, 200);
  const progress = progressResponse.body.data;
  assert.equal(progress.totalXP, 105);
  assert.equal(progress.level, 2);
  assert.equal(progress.xpIntoLevel, 5);
  assert.equal(progress.nextLevelXP, 200);
  assert.equal(progress.levelProgressPercentage, 52.5);
  assert.equal(progress.readingAssessmentsCompleted, 4);
  assert.equal(progress.writingActivitiesCompleted, 1);
  assert.equal(progress.lessonsCompleted, 4, 'A lesson completed in both activity types counts once.');
  assert.equal(progress.totalLessons, 40);
  assert.equal(progress.overallProgressPercentage, 10);
  assert.ok(progress.lastActivityAt);
  assert.ok(progress.recentActivities.some((activity) => activity.activityType === 'reading_assessment' && activity.xpEarned === 20));
  assert.ok(progress.recentActivities.some((activity) => activity.activityType === 'writing_activity' && activity.xpEarned === 25));

  const subjectProgress = await request(app).get('/api/progress/subjects').set({ Authorization: `Bearer ${tokenA}` });
  const milProgress = subjectProgress.body.data.subjects.find((subject) => subject.subjectCode === 'MIL');
  assert.equal(milProgress.completedLessons, 4);
  assert.equal(milProgress.totalLessons, 10);
  assert.equal(milProgress.percentage, 40);
  assert.equal(milProgress.completedReadingAssessments, 4);
  assert.equal(milProgress.totalReadingAssessments, 10);
  assert.equal(milProgress.completedWritingActivities, 1);
  assert.equal(milProgress.totalWritingActivities, 10);
  assert.equal(milProgress.totalXP, 105);
  assert.ok(subjectProgress.body.data.subjects.filter((subject) => subject.subjectCode !== 'MIL').every(({ completedLessons }) => completedLessons === 0));

  const forbiddenWrite = await request(app).post('/api/progress/me')
    .set({ Authorization: `Bearer ${tokenA}` })
    .send({ totalXP: 999999, level: 99, xpEarned: 999, isCompleted: true });
  assert.equal(forbiddenWrite.status, 404);
  const afterForbiddenWrite = await request(app).get('/api/progress/me').set({ Authorization: `Bearer ${tokenA}` });
  assert.equal(afterForbiddenWrite.body.data.totalXP, 105);
  assert.equal(afterForbiddenWrite.body.data.level, 2);
  assert.equal(await ActivityRecord.countDocuments({ user: studentA._id }), 5);
});

test('subject progress counts unique reading and writing work across all subjects and safely handles an empty subject', async () => {
  for (const subject of subjects) {
    const lesson = await Lesson.findOne({ subject: subject._id, lessonNumber: 1, isPublished: true, contentStatus: 'ready' });
    const questions = await ReadingQuestion.find({ lesson: lesson._id, isPublished: true }).sort({ order: 1 }).lean();
    const readingResponse = await request(app)
      .post(`/api/lessons/${lesson._id}/assessment`)
      .set({ Authorization: `Bearer ${tokenB}` })
      .send({ answers: questions.map(({ _id }) => ({ questionId: String(_id), selectedAnswer: 0 })) });
    assert.equal(readingResponse.status, 201);

    const activity = await WritingActivity.findOne({ lesson: lesson._id, isPublished: true });
    const writingResponseForLesson = await request(app)
      .post(`/api/lessons/${lesson._id}/writing`)
      .set({ Authorization: `Bearer ${tokenB}` })
      .send({ writingActivityId: String(activity._id), response: writingResponse });
    assert.equal(writingResponseForLesson.status, 201);
  }

  const emptySubject = await Subject.create({ name: 'Empty Subject', code: 'EMPTY', order: 99, isActive: true });
  const response = await request(app).get('/api/progress/subjects').set({ Authorization: `Bearer ${tokenB}` });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.subjects.length, 5);

  for (const code of ['MIL', 'UCSP', 'CPAR', 'ELS']) {
    const subjectProgress = response.body.data.subjects.find(({ subjectCode }) => subjectCode === code);
    assert.equal(subjectProgress.completedLessons, 1);
    assert.equal(subjectProgress.totalLessons, 10);
    assert.equal(subjectProgress.percentage, 10);
    assert.equal(subjectProgress.completedReadingAssessments, 1);
    assert.equal(subjectProgress.totalReadingAssessments, 10);
    assert.equal(subjectProgress.completedWritingActivities, 1);
    assert.equal(subjectProgress.totalWritingActivities, 10);
    assert.equal(subjectProgress.totalXP, 45);
  }

  const emptyProgress = response.body.data.subjects.find(({ subjectId }) => subjectId === String(emptySubject._id));
  assert.equal(emptyProgress.completedLessons, 0);
  assert.equal(emptyProgress.totalLessons, 0);
  assert.equal(emptyProgress.percentage, 0);
  assert.equal(emptyProgress.completedReadingAssessments, 0);
  assert.equal(emptyProgress.totalReadingAssessments, 0);
  assert.equal(emptyProgress.completedWritingActivities, 0);
  assert.equal(emptyProgress.totalWritingActivities, 0);
  assert.equal(emptyProgress.totalXP, 0);

  const studentAProgress = await request(app).get('/api/progress/subjects').set({ Authorization: `Bearer ${tokenA}` });
  assert.ok(studentAProgress.body.data.subjects.every(({ totalXP }) => totalXP === 105 || totalXP === 0));
  assert.equal(studentAProgress.body.data.subjects.find(({ subjectCode }) => subjectCode === 'UCSP').completedLessons, 0);
});
