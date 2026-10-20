const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { connectDatabase } = require('../config/database');
const { createApp } = require('../app');
const AssessmentAttempt = require('../models/AssessmentAttempt');
const Lesson = require('../models/Lesson');
const ReadingQuestion = require('../models/ReadingQuestion');
const StudentAchievement = require('../models/StudentAchievement');
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
const { hashPassword } = require('../utils/password');

const config = {
  jwtSecret: 'test-secret-that-is-long-enough-for-achievement-tests',
  jwtExpiresIn: '1h',
  corsOrigins: [],
};

let mongoServer;
let app;
let subjects;
let lessonsBySubject;
let admin;
let adminToken;

function tokenFor(user) {
  return jwt.sign({ sub: String(user._id) }, config.jwtSecret, {
    expiresIn: '1h', issuer: 'readsmart-api', audience: 'readsmart-mobile',
  });
}

async function createStudent(name = 'Badge Student') {
  const serial = new mongoose.Types.ObjectId().toString();
  const user = await User.create({
    name,
    email: `badge-${serial}@example.com`,
    passwordHash: await hashPassword('test-password-94'),
    role: 'student',
  });
  return { user, token: tokenFor(user) };
}

async function submitAssessment(token, lesson, { perfect = true } = {}) {
  const questions = await ReadingQuestion.find({ lesson: lesson._id, isPublished: true })
    .select('+correctAnswer')
    .sort({ order: 1 })
    .lean();
  const answers = questions.map((question, index) => ({
    questionId: String(question._id),
    selectedAnswer: !perfect && index === 0 ? (question.correctAnswer + 1) % question.choices.length : question.correctAnswer,
  }));
  return request(app)
    .post(`/api/lessons/${lesson._id}/assessment`)
    .set({ Authorization: `Bearer ${token}` })
    .send({ answers });
}

async function submitWriting(token, lesson) {
  const activity = await WritingActivity.findOne({ lesson: lesson._id, isPublished: true });
  const response = Array(activity.minimumWords).fill('learning').join(' ') + '.';
  return request(app)
    .post(`/api/lessons/${lesson._id}/writing`)
    .set({ Authorization: `Bearer ${token}` })
    .send({ writingActivityId: String(activity._id), response });
}

async function getBadges(token, query = '') {
  return request(app).get(`/api/progress/achievements${query}`).set({ Authorization: `Bearer ${token}` });
}

function badge(data, id) {
  return data.badges.find((item) => item.id === id);
}

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await connectDatabase(mongoServer.getUri('readsmart_achievements_test'));
  await applyReadingSeed();
  await applyMilContentImport();
  await applyUcspContentImport();
  await applyCparContentImport();
  await applyElsContentImport();
  await applyAssessmentSeed();
  await applyWritingSeed();
  await StudentAchievement.init();
  app = createApp(config);
  subjects = await Subject.find({ isActive: true }).sort({ order: 1 }).lean();
  lessonsBySubject = new Map();
  for (const subject of subjects) {
    lessonsBySubject.set(subject.code, await Lesson.find({ subject: subject._id, isPublished: true, contentStatus: 'ready' }).sort({ lessonNumber: 1 }).lean());
  }
  admin = await User.create({
    name: 'Achievement Admin',
    email: 'achievement-admin@example.com',
    passwordHash: await hashPassword('test-password-95'),
    role: 'admin',
  });
  adminToken = tokenFor(admin);
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test('a new student sees every badge locked, with progress based only on their own records', async () => {
  const first = await createStudent('Badge Student A');
  const second = await createStudent('Badge Student B');
  assert.equal((await request(app).get('/api/progress/achievements')).status, 401);

  const secondStudentLesson = lessonsBySubject.get('MIL')[0];
  assert.equal((await submitAssessment(second.token, secondStudentLesson)).status, 201);

  const response = await getBadges(first.token, `?userId=${second.user._id}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.data.totalCount, 5);
  assert.equal(response.body.data.earnedCount, 0);
  assert.ok(response.body.data.badges.every(({ earned }) => !earned));
  assert.equal(badge(response.body.data, 'first-learning-step').progress.current, 0);
  assert.equal(badge(response.body.data, 'across-subjects').progress.target, 4);
  assert.equal(await StudentAchievement.countDocuments({ user: first.user._id }), 0);
  const secondStudentResponse = await getBadges(second.token);
  assert.equal(badge(secondStudentResponse.body.data, 'first-learning-step').earned, true);
});

test('the first valid completed activity automatically awards the first-step badge', async () => {
  const student = await createStudent();
  const lesson = lessonsBySubject.get('MIL')[0];
  const submitted = await submitAssessment(student.token, lesson, { perfect: false });
  assert.equal(submitted.status, 201);

  const response = await getBadges(student.token);
  assert.equal(response.status, 200);
  assert.equal(response.body.data.earnedCount, 1);
  assert.equal(badge(response.body.data, 'first-learning-step').earned, true);
  assert.ok(badge(response.body.data, 'first-learning-step').earnedAt);
  assert.equal(badge(response.body.data, 'curious-reader').progress.current, 1);
  assert.equal(badge(response.body.data, 'perfect-score').earned, false);
});

test('unique assessment lessons and writing activities earn their multi-activity badges', async () => {
  const student = await createStudent();
  for (const lesson of lessonsBySubject.get('MIL').slice(0, 5)) {
    assert.equal((await submitAssessment(student.token, lesson)).status, 201);
  }
  for (const lesson of lessonsBySubject.get('UCSP').slice(0, 5)) {
    assert.equal((await submitWriting(student.token, lesson)).status, 201);
  }

  const response = await getBadges(student.token);
  assert.equal(response.status, 200);
  assert.equal(badge(response.body.data, 'curious-reader').earned, true);
  assert.equal(badge(response.body.data, 'writer-in-practice').earned, true);
  assert.equal(badge(response.body.data, 'curious-reader').progress.current, 5);
  assert.equal(badge(response.body.data, 'writer-in-practice').progress.current, 5);
  assert.equal(badge(response.body.data, 'perfect-score').earned, true);
});

test('one real completion in each currently eligible subject earns Across Subjects', async () => {
  const student = await createStudent();
  for (const subject of subjects) {
    const lesson = lessonsBySubject.get(subject.code)[0];
    assert.equal((await submitAssessment(student.token, lesson, { perfect: false })).status, 201);
  }
  const response = await getBadges(student.token);
  assert.equal(response.status, 200);
  const across = badge(response.body.data, 'across-subjects');
  assert.equal(across.earned, true);
  assert.equal(across.progress.current, 4);
  assert.equal(across.progress.target, 4);
});

test('a perfect badge requires a complete assessment with every point earned', async () => {
  const student = await createStudent();
  const result = await submitAssessment(student.token, lessonsBySubject.get('ELS')[0]);
  assert.equal(result.status, 201);
  assert.equal(result.body.data.score, result.body.data.totalPoints);
  assert.equal(result.body.data.percentage, 100);

  const response = await getBadges(student.token);
  const perfect = badge(response.body.data, 'perfect-score');
  assert.equal(perfect.earned, true);
  assert.equal(new Date(perfect.earnedAt).getTime(), new Date(result.body.data.submittedAt).getTime());
});

test('incomplete and orphaned assessment or writing records do not produce badges', async () => {
  const student = await createStudent();
  const lesson = lessonsBySubject.get('MIL')[0];
  const questions = await ReadingQuestion.find({ lesson: lesson._id, isPublished: true }).sort({ order: 1 }).lean();
  await AssessmentAttempt.create({
    user: student.user._id,
    lesson: lesson._id,
    answers: questions.slice(0, 4).map((question) => ({
      questionId: question._id,
      selectedAnswer: 0,
      isCorrect: false,
      pointsEarned: 0,
    })),
    score: 0,
    totalItems: questions.length,
    totalPoints: questions.reduce((sum, question) => sum + question.points, 0),
    percentage: 0,
  });
  const orphanLessonId = new mongoose.Types.ObjectId();
  await AssessmentAttempt.create({
    user: student.user._id,
    lesson: orphanLessonId,
    answers: questions.map((question) => ({ questionId: question._id, selectedAnswer: 0, isCorrect: false, pointsEarned: 0 })),
    score: 0,
    totalItems: questions.length,
    totalPoints: questions.length,
    percentage: 0,
  });
  const activity = await WritingActivity.findOne({ lesson: lesson._id });
  await WritingSubmission.create({
    user: student.user._id,
    lesson: lessonsBySubject.get('UCSP')[0]._id,
    writingActivity: activity._id,
    response: 'A saved response with a mismatched lesson relationship.',
    wordCount: 8,
    rubricScores: { grammar: 3, vocabulary: 3, organization: 3, coherence: 3, developmentOfIdeas: 3 },
    criterionFeedback: { grammar: 'ok', vocabulary: 'ok', organization: 'ok', coherence: 'ok', developmentOfIdeas: 'ok' },
    totalScore: 15,
    maxScore: 25,
    percentage: 60,
    feedback: 'Review the response.',
  });

  const response = await getBadges(student.token);
  assert.equal(response.status, 200);
  assert.equal(response.body.data.earnedCount, 0);
  assert.ok(response.body.data.badges.every(({ earned }) => !earned));
});

test('retries count one reading lesson and simultaneous completion requests cannot duplicate awards', async () => {
  const student = await createStudent();
  const lesson = lessonsBySubject.get('CPAR')[0];
  for (let index = 0; index < 5; index += 1) {
    assert.equal((await submitAssessment(student.token, lesson, { perfect: index === 4 })).status, 201);
  }
  const current = await getBadges(student.token);
  assert.equal(current.status, 200);
  assert.equal(badge(current.body.data, 'curious-reader').progress.current, 1);
  assert.equal(badge(current.body.data, 'first-learning-step').earned, true);

  await StudentAchievement.deleteMany({ user: student.user._id });
  const completionResults = await Promise.all(Array.from({ length: 4 }, () => submitAssessment(student.token, lesson)));
  assert.ok(completionResults.every((result) => result.status === 201));
  const parallelResults = await Promise.all(Array.from({ length: 8 }, () => getBadges(student.token)));
  assert.ok(parallelResults.every((result) => result.status === 200));
  const stored = await StudentAchievement.find({ user: student.user._id }).lean();
  assert.equal(stored.length, 2);
  assert.equal(new Set(stored.map(({ achievementId }) => achievementId)).size, stored.length);
});

test('an empty subject is excluded from Across Subjects eligibility and admins can view badge details', async () => {
  const student = await createStudent();
  await Subject.create({ name: 'No Activity Subject', code: 'NOACT', order: 99, isActive: true });
  const lesson = lessonsBySubject.get('MIL')[0];
  assert.equal((await submitAssessment(student.token, lesson, { perfect: false })).status, 201);
  const adminView = await request(app)
    .get(`/api/admin/users/${student.user._id}/progress`)
    .set({ Authorization: `Bearer ${adminToken}` });
  assert.equal(adminView.status, 200);
  assert.ok(Array.isArray(adminView.body.data.achievements.badges));
  assert.equal(badge(adminView.body.data.achievements, 'first-learning-step').earned, true);
  assert.equal(badge(adminView.body.data.achievements, 'across-subjects').progress.target, 4);

  const forbidden = await request(app)
    .get(`/api/admin/users/${student.user._id}/progress`)
    .set({ Authorization: `Bearer ${student.token}` });
  assert.equal(forbidden.status, 403);
});
