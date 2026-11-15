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
const DailyLearningGoal = require('../models/DailyLearningGoal');
const Lesson = require('../models/Lesson');
const StudentProgress = require('../models/StudentProgress');
const Subject = require('../models/Subject');
const User = require('../models/User');
const WritingActivity = require('../models/WritingActivity');
const WritingSubmission = require('../models/WritingSubmission');
const dailyGoalService = require('../services/dailyGoalService');

const config = {
  jwtSecret: 'daily-goals-test-secret-with-enough-length',
  jwtExpiresIn: '1h',
  corsOrigins: [],
};

let mongoServer;
let app;
let studentA;
let studentB;
let admin;
let tokenA;
let tokenB;
let adminToken;
let lessons;
let activities;

function tokenFor(user) {
  return jwt.sign({ sub: user.id }, config.jwtSecret, {
    expiresIn: '1h',
    issuer: 'readsmart-api',
    audience: 'readsmart-mobile',
  });
}

function criteria() {
  return [
    ['grammar', 'Grammar'],
    ['vocabulary', 'Vocabulary'],
    ['organization', 'Organization'],
    ['coherence', 'Coherence'],
    ['developmentOfIdeas', 'Development of Ideas'],
  ].map(([key, label]) => ({ key, label, description: `${label} is assessed.` }));
}

async function createAttempt(user, lesson, submittedAt) {
  return AssessmentAttempt.create({
    user: user._id,
    lesson: lesson._id,
    answers: [{ questionId: new mongoose.Types.ObjectId(), selectedAnswer: 1, isCorrect: true, pointsEarned: 1 }],
    score: 1,
    totalItems: 1,
    totalPoints: 1,
    percentage: 100,
    submittedAt,
  });
}

async function createWritingSubmission(user, lesson, activity, submittedAt) {
  const rubricScores = { grammar: 3, vocabulary: 3, organization: 3, coherence: 3, developmentOfIdeas: 3 };
  const criterionFeedback = Object.fromEntries(Object.keys(rubricScores).map((key) => [key, 'Keep developing this area.']));
  return WritingSubmission.create({
    user: user._id,
    lesson: lesson._id,
    writingActivity: activity._id,
    response: 'A saved student response containing enough words for a valid record.',
    wordCount: 11,
    rubricScores,
    criterionFeedback,
    totalScore: 15,
    maxScore: 25,
    percentage: 60,
    feedback: 'Continue developing the response with relevant support.',
    submittedAt,
  });
}

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await connectDatabase(mongoServer.getUri('readsmart_daily_goals_test'));
  app = createApp(config);
  [studentA, studentB, admin] = await Promise.all([
    User.create({ name: 'Daily Goals Student A', email: 'daily-goals-a@example.com', passwordHash: 'test-hash', role: 'student' }),
    User.create({ name: 'Daily Goals Student B', email: 'daily-goals-b@example.com', passwordHash: 'test-hash', role: 'student' }),
    User.create({ name: 'Daily Goals Admin', email: 'daily-goals-admin@example.com', passwordHash: 'test-hash', role: 'admin' }),
  ]);
  tokenA = tokenFor(studentA);
  tokenB = tokenFor(studentB);
  adminToken = tokenFor(admin);

  const subject = await Subject.create({ name: 'Daily Goals Subject', code: 'DGS', order: 1 });
  lessons = await Promise.all([1, 2, 3].map((lessonNumber) => Lesson.create({
    subject: subject._id,
    title: `Daily Goals Lesson ${lessonNumber}`,
    lessonNumber,
    lesson: 'Published lesson content for daily goals tests.',
    contentStatus: 'ready',
    isPublished: true,
  })));
  activities = await Promise.all([0, 2].map((index) => WritingActivity.create({
    lesson: lessons[index]._id,
    title: `Daily goal writing activity ${index + 1}`,
    prompt: 'Write a response about the lesson ideas and explain their importance.',
    instructions: 'Write a complete response with clear supporting explanations.',
    minimumWords: 5,
    maximumWords: 100,
    criteria: criteria(),
    isPublished: true,
  })));
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test('daily goals use a stable Asia/Manila calendar boundary', () => {
  assert.equal(dailyGoalService.DAILY_TIME_ZONE, 'Asia/Manila');
  assert.equal(dailyGoalService.getDateKey(new Date('2026-11-15T15:59:59.000Z')), '2026-11-15');
  assert.equal(dailyGoalService.getDateKey(new Date('2026-11-15T16:00:00.000Z')), '2026-11-16');
  assert.equal(dailyGoalService.getDateRange('2026-11-16').start.toISOString(), '2026-11-15T16:00:00.000Z');
  assert.equal(dailyGoalService.getDateRange('2026-11-16').end.toISOString(), '2026-11-16T16:00:00.000Z');
});

test('daily goal routes authenticate students and reject administrator access', async () => {
  assert.equal((await request(app).get('/api/daily-goals/today')).status, 401);
  assert.equal((await request(app).put('/api/daily-goals/today')).status, 401);
  assert.equal((await request(app).get('/api/daily-goals/history')).status, 401);
  const adminResponse = await request(app).get('/api/daily-goals/today').set({ Authorization: `Bearer ${adminToken}` });
  assert.equal(adminResponse.status, 403);
});

test('student can create and update only daily targets and invalid targets receive validation errors', async () => {
  const auth = { Authorization: `Bearer ${tokenA}` };
  const created = await request(app).get('/api/daily-goals/today').set(auth);
  assert.equal(created.status, 200);
  assert.equal(created.body.data.dailyGoal.timeZone, 'Asia/Manila');
  assert.deepEqual(created.body.data.dailyGoal.targets, { readingLessons: 1, assessments: 1, writingActivities: 1 });
  assert.equal(await DailyLearningGoal.countDocuments({ user: studentA._id }), 1);

  const targets = { readingLessons: 2, assessments: 2, writingActivities: 2 };
  const updated = await request(app).put('/api/daily-goals/today').set(auth).send({ targets });
  assert.equal(updated.status, 200);
  assert.deepEqual(updated.body.data.dailyGoal.targets, targets);

  for (const invalidTargets of [
    { readingLessons: 0, assessments: 1, writingActivities: 1 },
    { readingLessons: 11, assessments: 1, writingActivities: 1 },
    { readingLessons: 1.5, assessments: 1, writingActivities: 1 },
    { readingLessons: 1, assessments: 1 },
  ]) {
    const response = await request(app).put('/api/daily-goals/today').set(auth).send({ targets: invalidTargets });
    assert.equal(response.status, 400);
  }
  const forgedCompletion = await request(app).put('/api/daily-goals/today').set(auth)
    .send({ targets, completedGoals: 3, readingLessonsCompleted: 100 });
  assert.equal(forgedCompletion.status, 400);
});

test('daily progress counts successful unique activities per Manila day without changing XP', async () => {
  const today = dailyGoalService.getDateKey(new Date());
  const { start } = dailyGoalService.getDateRange(today);
  const todayTime = new Date(start.getTime() + (12 * 60 * 60 * 1000));
  const yesterday = dailyGoalService.getDateKey(new Date(start.getTime() - 1));
  const { start: yesterdayStart } = dailyGoalService.getDateRange(yesterday);
  const yesterdayTime = new Date(yesterdayStart.getTime() + (12 * 60 * 60 * 1000));

  await createAttempt(studentA, lessons[0], todayTime);
  await createAttempt(studentA, lessons[0], new Date(todayTime.getTime() + 60_000));
  // A mismatched lesson/activity pair is ignored; only the valid pair counts.
  await createWritingSubmission(studentA, lessons[1], activities[0], todayTime);
  await createWritingSubmission(studentA, lessons[2], activities[1], new Date(todayTime.getTime() + 120_000));
  await createWritingSubmission(studentA, lessons[2], activities[1], new Date(todayTime.getTime() + 180_000));
  await createAttempt(studentA, lessons[2], yesterdayTime);
  await DailyLearningGoal.create({
    user: studentA._id,
    dateKey: yesterday,
    targets: { readingLessons: 1, assessments: 1, writingActivities: 1 },
  });

  const auth = { Authorization: `Bearer ${tokenA}` };
  const todayResponse = await request(app).get('/api/daily-goals/today').set(auth);
  assert.equal(todayResponse.status, 200);
  const todayGoal = todayResponse.body.data.dailyGoal;
  assert.equal(todayGoal.goals.find(({ key }) => key === 'readingLessons').completed, 2);
  assert.equal(todayGoal.goals.find(({ key }) => key === 'assessments').completed, 1);
  assert.equal(todayGoal.goals.find(({ key }) => key === 'writingActivities').completed, 1);
  assert.equal(todayGoal.completedGoals, 1);
  assert.equal(todayGoal.remainingGoals, 2);
  assert.equal(todayGoal.completionPercentage, 67);

  const history = await request(app).get('/api/daily-goals/history?page=1&limit=10').set(auth);
  assert.equal(history.status, 200);
  assert.deepEqual(history.body.data.records.map(({ dateKey }) => dateKey), [today, yesterday]);
  assert.equal(history.body.data.records[1].goals.find(({ key }) => key === 'readingLessons').completed, 1);
  assert.equal(await DailyLearningGoal.countDocuments({ user: studentA._id }), 2);
  assert.equal(await ActivityRecord.countDocuments({ user: studentA._id }), 0);
  assert.equal(await StudentProgress.countDocuments({ user: studentA._id }), 0);
});

test('daily goal records are private to each student and history pagination is validated', async () => {
  const authA = { Authorization: `Bearer ${tokenA}` };
  const authB = { Authorization: `Bearer ${tokenB}` };
  const otherStudent = await request(app).get(`/api/daily-goals/today?userId=${studentA.id}`).set(authB);
  assert.equal(otherStudent.status, 200);
  assert.deepEqual(otherStudent.body.data.dailyGoal.targets, { readingLessons: 1, assessments: 1, writingActivities: 1 });
  assert.ok(otherStudent.body.data.dailyGoal.goals.every(({ completed }) => completed === 0));
  assert.equal(await DailyLearningGoal.countDocuments({ user: studentB._id }), 1);

  const malformed = await request(app).get('/api/daily-goals/history?page=0').set(authA);
  assert.equal(malformed.status, 400);
  const extraQuery = await request(app).get('/api/daily-goals/history?userId=' + studentB.id).set(authA);
  assert.equal(extraQuery.status, 400);
  const historyB = await request(app).get('/api/daily-goals/history').set(authB);
  assert.equal(historyB.status, 200);
  assert.equal(historyB.body.data.records.length, 1);
  assert.equal(await ActivityRecord.countDocuments({ user: studentB._id }), 0);
});

test('simultaneous first reads create only one daily goal record per student and date', async () => {
  const studentC = await User.create({
    name: 'Daily Goals Student C',
    email: 'daily-goals-c@example.com',
    passwordHash: 'test-hash',
    role: 'student',
  });
  const auth = { Authorization: `Bearer ${tokenFor(studentC)}` };
  const responses = await Promise.all(Array.from({ length: 8 }, () => request(app).get('/api/daily-goals/today').set(auth)));
  assert.ok(responses.every(({ status }) => status === 200));
  assert.equal(await DailyLearningGoal.countDocuments({ user: studentC._id }), 1);
});
