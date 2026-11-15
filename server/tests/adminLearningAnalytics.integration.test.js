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
const Subject = require('../models/Subject');
const User = require('../models/User');
const WritingActivity = require('../models/WritingActivity');
const WritingSubmission = require('../models/WritingSubmission');
const analyticsService = require('../services/adminLearningAnalyticsService');

const config = { jwtSecret: 'analytics-test-secret-with-sufficient-length', jwtExpiresIn: '1h', corsOrigins: [] };
let mongoServer;
let app;
let admin;
let studentA;
let studentB;
let adminToken;
let studentToken;
let mil;
let ucsp;
let milLesson;
let ucspLesson;
let milActivity;

function token(user) {
  return jwt.sign({ sub: String(user._id) }, config.jwtSecret, {
    expiresIn: '1h', issuer: 'readsmart-api', audience: 'readsmart-mobile',
  });
}

async function addAssessment(user, lesson, percentage, submittedAt) {
  return AssessmentAttempt.create({
    user: user._id,
    lesson: lesson?._id || new mongoose.Types.ObjectId(),
    answers: [{ questionId: new mongoose.Types.ObjectId(), selectedAnswer: 1, isCorrect: true, pointsEarned: 1 }],
    score: percentage,
    totalItems: 100,
    totalPoints: 100,
    percentage,
    submittedAt,
  });
}

function rubric(grade) {
  return { grammar: grade, vocabulary: grade, organization: grade, coherence: grade, developmentOfIdeas: grade };
}

async function addWriting(user, lesson, activity, percentage, submittedAt) {
  const score = Math.round(percentage / 20);
  const rubricScores = rubric(score);
  return WritingSubmission.create({
    user: user._id,
    lesson: lesson._id,
    writingActivity: activity._id,
    response: 'A stored writing response that includes relevant ideas and sufficient detail.',
    wordCount: 12,
    rubricScores,
    criterionFeedback: Object.fromEntries(Object.keys(rubricScores).map((key) => [key, 'Continue developing this criterion.'])),
    totalScore: score * 5,
    maxScore: 25,
    percentage: score * 20,
    feedback: 'Keep developing the response.',
    submittedAt,
  });
}

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await connectDatabase(mongoServer.getUri('readsmart_admin_analytics_test'));
  app = createApp(config);
  [admin, studentA, studentB] = await Promise.all([
    User.create({ name: 'Analytics Admin', email: 'analytics-admin@example.com', passwordHash: 'hash', role: 'admin' }),
    User.create({ name: 'Analytics Student A', email: 'analytics-a@example.com', passwordHash: 'hash', role: 'student' }),
    User.create({ name: 'Analytics Student B', email: 'analytics-b@example.com', passwordHash: 'hash', role: 'student' }),
  ]);
  adminToken = token(admin);
  studentToken = token(studentA);
  [mil, ucsp] = await Promise.all([
    Subject.create({ name: 'Media and Information Literacy', code: 'MIL', order: 1 }),
    Subject.create({ name: 'Understanding Culture, Society and Politics', code: 'UCSP', order: 2 }),
  ]);
  [milLesson, ucspLesson] = await Promise.all([
    Lesson.create({ subject: mil._id, title: 'Analytics MIL lesson', lessonNumber: 1, lesson: 'Published content for analytics.', contentStatus: 'ready', isPublished: true }),
    Lesson.create({ subject: ucsp._id, title: 'Analytics UCSP lesson', lessonNumber: 1, lesson: 'Published content for analytics.', contentStatus: 'ready', isPublished: true }),
  ]);
  milActivity = await WritingActivity.create({
    lesson: milLesson._id,
    title: 'Analytics writing task',
    prompt: 'Explain one important idea from the lesson and support your response with an example.',
    instructions: 'Write a complete response with clear supporting explanations.',
    minimumWords: 5,
    maximumWords: 100,
    criteria: ['grammar', 'vocabulary', 'organization', 'coherence', 'developmentOfIdeas'].map((key) => ({
      key, label: key, description: `Evaluate ${key}.`, maximumScore: 5,
    })),
    isPublished: true,
  });
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test('admin analytics endpoint enforces authentication and administrator role, and validates period filters', async () => {
  assert.equal((await request(app).get('/api/admin/analytics')).status, 401);
  assert.equal((await request(app).get('/api/admin/analytics').set({ Authorization: `Bearer ${studentToken}` })).status, 403);
  const invalidPeriod = await request(app).get('/api/admin/analytics?period=quarterly').set({ Authorization: `Bearer ${adminToken}` });
  assert.equal(invalidPeriod.status, 400);
  const extraFilter = await request(app).get('/api/admin/analytics?period=daily&userId=' + studentA.id).set({ Authorization: `Bearer ${adminToken}` });
  assert.equal(extraFilter.status, 400);
});

test('empty analytics returns database student and subject counts with zero activity and null averages', async () => {
  const response = await request(app).get('/api/admin/analytics?period=weekly').set({ Authorization: `Bearer ${adminToken}` });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.summary.totalStudents, 2);
  assert.equal(response.body.data.summary.activeLearners, 0);
  assert.equal(response.body.data.summary.completedReadingLessons, 0);
  assert.equal(response.body.data.summary.completedAssessments, 0);
  assert.equal(response.body.data.summary.completedWritingActivities, 0);
  assert.equal(response.body.data.summary.averageComprehensionScore, null);
  assert.equal(response.body.data.summary.averageWritingScore, null);
  assert.deepEqual(response.body.data.subjects.map(({ subjectCode }) => subjectCode), ['MIL', 'UCSP']);
  assert.equal(response.body.data.trends.length, 7);
});

test('analytics calculates unique completed lessons, submissions, averages, active learners, and subject performance from actual records', async () => {
  const now = new Date();
  const recent = new Date(now.getTime() - 5 * 60 * 1000);
  const next = new Date(now.getTime() - 4 * 60 * 1000);
  await addAssessment(studentA, milLesson, 60, recent);
  await addAssessment(studentA, milLesson, 80, next);
  await addAssessment(studentA, ucspLesson, 40, next);
  await addWriting(studentA, milLesson, milActivity, 80, recent);
  await addWriting(studentA, milLesson, milActivity, 80, next);
  await addAssessment(studentB, null, 20, recent);

  const response = await request(app).get('/api/admin/analytics?period=weekly').set({ Authorization: `Bearer ${adminToken}` });
  assert.equal(response.status, 200);
  const { summary, subjects, trends, timeZone } = response.body.data;
  assert.equal(timeZone, 'Asia/Manila');
  assert.equal(summary.totalStudents, 2);
  assert.equal(summary.activeLearners, 2);
  assert.equal(summary.completedReadingLessons, 2);
  assert.equal(summary.completedAssessments, 4);
  assert.equal(summary.completedWritingActivities, 1);
  assert.equal(summary.averageComprehensionScore, 50);
  assert.equal(summary.averageWritingScore, 80);
  const milSummary = subjects.find(({ subjectCode }) => subjectCode === 'MIL');
  const ucspSummary = subjects.find(({ subjectCode }) => subjectCode === 'UCSP');
  assert.equal(milSummary.completedLessons, 1);
  assert.equal(milSummary.completedAssessments, 2);
  assert.equal(milSummary.averageAssessmentScore, 70);
  assert.equal(ucspSummary.completedLessons, 1);
  assert.equal(ucspSummary.completedAssessments, 1);
  assert.equal(ucspSummary.averageAssessmentScore, 40);
  const activityDay = trends.find(({ completedAssessments }) => completedAssessments > 0);
  assert.ok(activityDay);
  assert.equal(activityDay.activeLearners, 2);
  assert.equal(activityDay.completedReadingLessons, 2);
  assert.equal(activityDay.completedWritingActivities, 1);
});

test('daily, weekly, monthly, and all-time filters use Asia/Manila calendar boundaries and return the corresponding records', async () => {
  const now = new Date('2026-11-16T04:30:00.000Z');
  const daily = analyticsService.getPeriodRange('daily', now);
  const weekly = analyticsService.getPeriodRange('weekly', now);
  const monthly = analyticsService.getPeriodRange('monthly', now);
  const allTime = analyticsService.getPeriodRange('allTime', now);
  assert.equal(daily.start.toISOString(), '2026-11-15T16:00:00.000Z');
  assert.equal(daily.end.toISOString(), now.toISOString());
  assert.equal(weekly.start.toISOString(), '2026-11-09T16:00:00.000Z');
  assert.equal(monthly.start.toISOString(), '2026-10-17T16:00:00.000Z');
  assert.equal(allTime.start, null);
  assert.equal(allTime.end, now);

  const actualNow = new Date();
  await addAssessment(studentB, milLesson, 50, new Date(actualNow.getTime() - 10 * 24 * 60 * 60 * 1000));
  await addAssessment(studentB, ucspLesson, 100, new Date(actualNow.getTime() - 40 * 24 * 60 * 60 * 1000));
  const dailyResult = await analyticsService.getAdminLearningAnalytics('daily', actualNow);
  const weeklyResult = await analyticsService.getAdminLearningAnalytics('weekly', actualNow);
  const monthlyResult = await analyticsService.getAdminLearningAnalytics('monthly', actualNow);
  const allTimeResult = await analyticsService.getAdminLearningAnalytics('allTime', actualNow);
  assert.equal(dailyResult.summary.completedAssessments, 4);
  assert.equal(weeklyResult.summary.completedAssessments, 4);
  assert.equal(monthlyResult.summary.completedAssessments, 5);
  assert.equal(allTimeResult.summary.completedAssessments, 6);
});
