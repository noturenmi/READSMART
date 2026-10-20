const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { connectDatabase } = require('../config/database');
const { createApp } = require('../app');
const ActivityRecord = require('../models/ActivityRecord');
const AssessmentAttempt = require('../models/AssessmentAttempt');
const Lesson = require('../models/Lesson');
const ReadingQuestion = require('../models/ReadingQuestion');
const Subject = require('../models/Subject');
const User = require('../models/User');
const { applyReadingSeed } = require('../seed/seedReadingData');
const { applyMilContentImport } = require('../seed/importMilContent');
const { applyUcspContentImport } = require('../seed/importUcspContent');
const { applyCparContentImport } = require('../seed/importCparContent');
const { applyElsContentImport } = require('../seed/importElsContent');
const { applyAssessmentSeed } = require('../seed/seedAssessmentData');

const config = {
  jwtSecret: 'test-secret-that-is-long-enough-for-recommendation-tests',
  jwtExpiresIn: '1h',
  corsOrigins: [],
};

let mongoServer;
let app;
let subjectsByCode;
let lessonsByCode;
let studentA;
let studentB;
let studentC;
let admin;
let tokenA;
let tokenB;
let tokenC;
let adminToken;

function createToken(user) {
  return jwt.sign({ sub: user.id }, config.jwtSecret, {
    expiresIn: '1h',
    issuer: 'readsmart-api',
    audience: 'readsmart-mobile',
  });
}

async function recordAttempt(user, lesson, { wrongIndexes = [], percentage, submittedAt }) {
  const questions = await ReadingQuestion.find({ lesson: lesson._id, isPublished: true })
    .sort({ order: 1 })
    .lean();
  const answers = questions.map((question, index) => {
    const isCorrect = !wrongIndexes.includes(index);
    return {
      questionId: question._id,
      selectedAnswer: isCorrect ? 0 : 1,
      isCorrect,
      pointsEarned: isCorrect ? question.points : 0,
    };
  });
  const totalPoints = questions.reduce((sum, question) => sum + question.points, 0);
  return AssessmentAttempt.create({
    user: user._id,
    lesson: lesson._id,
    answers,
    score: Math.round((percentage / 100) * totalPoints),
    totalItems: questions.length,
    totalPoints,
    percentage,
    submittedAt,
  });
}

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await connectDatabase(mongoServer.getUri('readsmart_recommendations_test'));
  await applyReadingSeed();
  await applyMilContentImport();
  await applyUcspContentImport();
  await applyCparContentImport();
  await applyElsContentImport();
  await applyAssessmentSeed();
  app = createApp(config);

  const subjects = await Subject.find({ isActive: true }).lean();
  subjectsByCode = new Map(subjects.map((subject) => [subject.code, subject]));
  lessonsByCode = new Map();
  for (const [code, subject] of subjectsByCode) {
    const lessons = await Lesson.find({ subject: subject._id, isPublished: true, contentStatus: 'ready' })
      .sort({ lessonNumber: 1 })
      .lean();
    lessonsByCode.set(code, lessons);
  }

  studentA = await User.create({
    name: 'Recommendation Student A',
    email: 'recommendation-a@example.com',
    passwordHash: 'test-hash',
    role: 'student',
  });
  studentB = await User.create({
    name: 'Recommendation Student B',
    email: 'recommendation-b@example.com',
    passwordHash: 'test-hash',
    role: 'student',
  });
  studentC = await User.create({
    name: 'Recommendation Student C',
    email: 'recommendation-c@example.com',
    passwordHash: 'test-hash',
    role: 'student',
  });
  admin = await User.create({
    name: 'Recommendation Admin',
    email: 'recommendation-admin@example.com',
    passwordHash: 'test-hash',
    role: 'admin',
  });
  tokenA = createToken(studentA);
  tokenB = createToken(studentB);
  tokenC = createToken(studentC);
  adminToken = createToken(admin);
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test('recommendations require authentication and students without assessment history get a useful empty state', async () => {
  assert.equal((await request(app).get('/api/progress/recommendations')).status, 401);
  const response = await request(app)
    .get('/api/progress/recommendations')
    .set({ Authorization: 'Bearer ' + tokenB });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.recommendations, []);
  assert.equal(response.body.data.emptyReason, 'no_assessment_history');
});

test('recommendations use latest incorrect answers and low scores, rank repeated difficulties, and avoid duplicate lessons', async () => {
  const now = Date.now();
  const mil1 = lessonsByCode.get('MIL')[0];
  const mil2 = lessonsByCode.get('MIL')[1];
  const ucsp1 = lessonsByCode.get('UCSP')[0];
  const cpar1 = lessonsByCode.get('CPAR')[0];

  await recordAttempt(studentA, mil1, {
    percentage: 80,
    wrongIndexes: [0],
    submittedAt: new Date(now - 20000),
  });
  await recordAttempt(studentA, mil1, {
    percentage: 60,
    wrongIndexes: [0, 1],
    submittedAt: new Date(now - 10000),
  });
  await recordAttempt(studentA, mil2, {
    percentage: 60,
    wrongIndexes: [1, 2],
    submittedAt: new Date(now - 5000),
  });
  await recordAttempt(studentA, ucsp1, {
    percentage: 80,
    wrongIndexes: [0],
    submittedAt: new Date(now - 3000),
  });
  await recordAttempt(studentA, cpar1, {
    percentage: 40,
    wrongIndexes: [0, 1, 2],
    submittedAt: new Date(now - 2000),
  });
  await recordAttempt(studentA, cpar1, {
    percentage: 100,
    submittedAt: new Date(now - 1000),
  });

  const beforeXP = await ActivityRecord.countDocuments({ user: studentA._id });
  const beforeProgress = await request(app)
    .get('/api/progress/me')
    .set({ Authorization: 'Bearer ' + tokenA });
  assert.equal(beforeProgress.status, 200);
  const response = await request(app)
    .get('/api/progress/recommendations')
    .set({ Authorization: 'Bearer ' + tokenA });
  assert.equal(response.status, 200);
  const recommendations = response.body.data.recommendations;
  const recommendedLessonIds = recommendations.map(({ lessonId }) => lessonId);
  assert.equal(new Set(recommendedLessonIds).size, recommendations.length);
  assert.deepEqual(recommendedLessonIds, [
    String(mil1._id),
    String(mil2._id),
    String(ucsp1._id),
  ]);
  assert.match(recommendations[0].reason, /^You missed 1 question in this lesson on more than one attempt\./);
  assert.match(recommendations[1].reason, /latest assessment had 2 incorrect answers/);
  assert.match(recommendations[2].reason, /latest assessment had 1 incorrect answer/);
  assert.equal(recommendations.some(({ lessonId }) => lessonId === String(cpar1._id)), false);
  assert.ok(recommendations.every(({ lessonTitle, subjectName, reason }) => lessonTitle && subjectName && reason));
  assert.equal(await ActivityRecord.countDocuments({ user: studentA._id }), beforeXP);

  const progress = await request(app)
    .get('/api/progress/me')
    .set({ Authorization: 'Bearer ' + tokenA });
  assert.equal(progress.status, 200);
  assert.equal(progress.body.data.totalXP, beforeProgress.body.data.totalXP);
  assert.equal(progress.body.data.level, beforeProgress.body.data.level);
  assert.equal(progress.body.data.overallProgressPercentage, beforeProgress.body.data.overallProgressPercentage);
});

test('low scores in a subject and performance across subjects are reflected without leaking another student data', async () => {
  const mil3 = lessonsByCode.get('MIL')[2];
  const mil4 = lessonsByCode.get('MIL')[3];
  const els1 = lessonsByCode.get('ELS')[0];
  const now = Date.now();
  await recordAttempt(studentC, mil3, { percentage: 40, wrongIndexes: [0, 1, 2], submittedAt: new Date(now - 4000) });
  await recordAttempt(studentC, mil4, { percentage: 60, wrongIndexes: [0, 1], submittedAt: new Date(now - 3000) });
  await recordAttempt(studentC, els1, { percentage: 80, wrongIndexes: [0], submittedAt: new Date(now - 2000) });

  const studentResponse = await request(app)
    .get('/api/progress/recommendations?userId=' + studentA.id)
    .set({ Authorization: 'Bearer ' + tokenB });
  assert.equal(studentResponse.status, 200);
  assert.deepEqual(studentResponse.body.data.recommendations, []);
  assert.equal(studentResponse.body.data.emptyReason, 'no_assessment_history');

  const ownResponse = await request(app)
    .get('/api/progress/recommendations')
    .set({ Authorization: 'Bearer ' + tokenC });
  assert.equal(ownResponse.status, 200);
  const milRecommendations = ownResponse.body.data.recommendations.filter(({ subjectCode }) => subjectCode === 'MIL');
  const elsRecommendation = ownResponse.body.data.recommendations.find(({ subjectCode }) => subjectCode === 'ELS');
  assert.ok(milRecommendations.some(({ lessonId }) => lessonId === String(mil3._id)));
  assert.ok(milRecommendations.some(({ lessonId }) => lessonId === String(mil4._id)));
  assert.ok(elsRecommendation);
  assert.deepEqual(
    ownResponse.body.data.recommendations.map(({ lessonId }) => lessonId),
    [String(mil3._id), String(mil4._id), String(els1._id)],
  );

  const adminResponse = await request(app)
    .get('/api/admin/users/' + studentC.id + '/progress')
    .set({ Authorization: 'Bearer ' + adminToken });
  assert.equal(adminResponse.status, 200);
  assert.ok(adminResponse.body.data.recommendations.some(({ lessonId }) => lessonId === String(mil3._id)));

  const studentAdminResponse = await request(app)
    .get('/api/admin/users/' + studentC.id + '/progress')
    .set({ Authorization: 'Bearer ' + tokenB });
  assert.equal(studentAdminResponse.status, 403);
});

test('latest all-correct assessments clear old recommendations', async () => {
  const lessons = [
    lessonsByCode.get('MIL')[2],
    lessonsByCode.get('MIL')[3],
    lessonsByCode.get('ELS')[0],
  ];
  const submittedAt = new Date(Date.now() + 10000);
  for (const lesson of lessons) {
    await recordAttempt(studentC, lesson, { percentage: 100, submittedAt });
  }

  const response = await request(app)
    .get('/api/progress/recommendations')
    .set({ Authorization: 'Bearer ' + tokenC });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.recommendations, []);
  assert.equal(response.body.data.emptyReason, 'no_lessons_need_review');
});

test('mastered lessons, unpublished lessons, orphan attempts, and incomplete latest attempts do not create false recommendations', async () => {
  const lesson = lessonsByCode.get('ELS')[1];
  const before = new Date(Date.now() - 10000);
  const afterLatest = new Date(Date.now() - 1000);
  await recordAttempt(studentB, lesson, { percentage: 40, wrongIndexes: [0, 1, 2], submittedAt: before });
  await AssessmentAttempt.collection.insertOne({
    user: studentB._id,
    lesson: lesson._id,
    answers: [],
    score: 0,
    totalItems: 5,
    totalPoints: 0,
    percentage: null,
    submittedAt: afterLatest,
    createdAt: afterLatest,
    updatedAt: afterLatest,
  });

  const orphanLessonId = new mongoose.Types.ObjectId();
  await AssessmentAttempt.collection.insertOne({
    user: studentB._id,
    lesson: orphanLessonId,
    answers: [],
    score: 0,
    totalItems: 5,
    totalPoints: 5,
    percentage: 0,
    submittedAt: afterLatest,
    createdAt: afterLatest,
    updatedAt: afterLatest,
  });
  const unpublishedLesson = await Lesson.create({
    subject: subjectsByCode.get('ELS')._id,
    title: 'Unpublished recommendation fixture',
    lessonNumber: 11,
    overview: '',
    lesson: 'This unpublished lesson exists only for recommendation filtering tests.',
    contentStatus: 'ready',
    isPublished: false,
  });
  await ReadingQuestion.create({
    lesson: unpublishedLesson._id,
    question: 'This unpublished question must not make a lesson recommendable?',
    questionType: 'key_idea',
    choices: ['Option A', 'Option B', 'Option C', 'Option D'],
    correctAnswer: 0,
    explanation: 'The unpublished lesson must be excluded from student recommendations.',
    points: 1,
    order: 1,
    isPublished: true,
  });
  await AssessmentAttempt.collection.insertOne({
    user: studentB._id,
    lesson: unpublishedLesson._id,
    answers: [],
    score: 0,
    totalItems: 1,
    totalPoints: 1,
    percentage: 0,
    submittedAt: afterLatest,
    createdAt: afterLatest,
    updatedAt: afterLatest,
  });

  const response = await request(app)
    .get('/api/progress/recommendations')
    .set({ Authorization: 'Bearer ' + tokenB });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.recommendations, []);
  assert.equal(response.body.data.emptyReason, 'assessment_data_incomplete');
});
