const assert = require('node:assert/strict');
const { after, before, beforeEach, test } = require('node:test');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { connectDatabase } = require('../config/database');
const { createApp } = require('../app');
const DailyLearningGoal = require('../models/DailyLearningGoal');
const AssessmentAttempt = require('../models/AssessmentAttempt');
const ActivityRecord = require('../models/ActivityRecord');
const Lesson = require('../models/Lesson');
const Notification = require('../models/Notification');
const ReadingQuestion = require('../models/ReadingQuestion');
const Subject = require('../models/Subject');
const User = require('../models/User');
const WritingActivity = require('../models/WritingActivity');
const WritingSubmission = require('../models/WritingSubmission');
const StudentProgress = require('../models/StudentProgress');
const StudentAchievement = require('../models/StudentAchievement');
const notificationService = require('../services/notificationService');

const config = {
  jwtSecret: 'notifications-test-secret-with-enough-length',
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
let lesson;
let question;
let activity;

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

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await connectDatabase(mongoServer.getUri('readsmart_notifications_test'));
  app = createApp(config);
  [studentA, studentB, admin] = await Promise.all([
    User.create({ name: 'Notification Student A', email: 'notifications-a@example.com', passwordHash: 'test-hash', role: 'student' }),
    User.create({ name: 'Notification Student B', email: 'notifications-b@example.com', passwordHash: 'test-hash', role: 'student' }),
    User.create({ name: 'Notification Admin', email: 'notifications-admin@example.com', passwordHash: 'test-hash', role: 'admin' }),
  ]);
  tokenA = tokenFor(studentA);
  tokenB = tokenFor(studentB);
  adminToken = tokenFor(admin);

  const subject = await Subject.create({ name: 'Notification Subject', code: 'NFS', order: 1 });
  lesson = await Lesson.create({
    subject: subject._id,
    title: 'Notification Test Lesson',
    lessonNumber: 1,
    lesson: 'A published lesson with enough content for its assessment and writing activity.',
    discussion: 'Discussion content supporting the lesson concepts.',
    contentStatus: 'ready',
    isPublished: true,
  });
  question = await ReadingQuestion.create({
    lesson: lesson._id,
    question: 'Which choice best describes the lesson idea?',
    questionType: 'key_idea',
    choices: ['The correct answer', 'A second answer', 'A third answer', 'A fourth answer'],
    correctAnswer: 1,
    explanation: 'This answer matches the central idea of the lesson.',
    points: 1,
    order: 1,
    isPublished: true,
  });
  activity = await WritingActivity.create({
    lesson: lesson._id,
    title: 'Explain the lesson',
    prompt: 'Explain the lesson idea and why it matters to students.',
    instructions: 'Write a short response using complete sentences and supporting details.',
    minimumWords: 5,
    maximumWords: 100,
    criteria: criteria(),
    isPublished: true,
  });
});

beforeEach(async () => {
  await Promise.all([
    Notification.deleteMany({}),
    DailyLearningGoal.deleteMany({}),
    AssessmentAttempt.deleteMany({}),
    WritingSubmission.deleteMany({}),
    ActivityRecord.deleteMany({}),
    StudentProgress.deleteMany({}),
    StudentAchievement.deleteMany({}),
  ]);
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test('notification APIs require an authenticated student and keep notification data private', async () => {
  assert.equal((await request(app).get('/api/notifications')).status, 401);
  assert.equal((await request(app).get('/api/notifications/unread-count')).status, 401);
  assert.equal((await request(app).patch('/api/notifications/read-all')).status, 401);
  assert.equal((await request(app).get('/api/notifications').set('Authorization', `Bearer ${adminToken}`)).status, 403);

  const attemptId = new mongoose.Types.ObjectId();
  await Promise.all(Array.from({ length: 4 }, () => notificationService.createAssessmentResult({
    userId: studentA._id,
    attemptId,
    lessonId: lesson._id,
  })));
  const studentBResult = await request(app).get('/api/notifications').set('Authorization', `Bearer ${tokenB}`);
  assert.equal(studentBResult.status, 200);
  assert.equal(studentBResult.body.data.notifications.length, 0);
  const studentAResult = await request(app).get('/api/notifications').set('Authorization', `Bearer ${tokenA}`);
  assert.equal(studentAResult.body.data.notifications.length, 1);
});

test('assessment and writing completion persist deduplicated result notifications and daily goal milestones', async () => {
  const auth = { Authorization: `Bearer ${tokenA}` };
  const goal = await request(app).get('/api/daily-goals/today').set(auth);
  assert.equal(goal.status, 200);

  const questions = await request(app).get(`/api/lessons/${lesson.id}/questions`).set(auth);
  assert.equal(questions.status, 200);
  assert.equal(Object.hasOwn(questions.body.data.questions[0], 'correctAnswer'), false);
  const assessment = await request(app).post(`/api/lessons/${lesson.id}/assessment`).set(auth).send({
    answers: [{ questionId: question.id, selectedAnswer: 1 }],
  });
  assert.equal(assessment.status, 201);
  const attemptId = assessment.body.data.attemptId;
  assert.equal(await Notification.countDocuments({ user: studentA._id, type: 'assessment_result' }), 1);

  await notificationService.createAssessmentResult({ userId: studentA._id, attemptId, lessonId: lesson._id });
  assert.equal(await Notification.countDocuments({ user: studentA._id, type: 'assessment_result' }), 1);

  const writing = await request(app).post(`/api/lessons/${lesson.id}/writing`).set(auth).send({
    writingActivityId: activity.id,
    response: 'This response explains the lesson idea with several supporting details.',
    requestKey: 'notification-test-request-01',
  });
  assert.equal(writing.status, 201);
  const submissionId = writing.body.data.submissionId;
  assert.equal(await Notification.countDocuments({ user: studentA._id, type: 'writing_feedback' }), 1);

  const repeated = await request(app).post(`/api/lessons/${lesson.id}/writing`).set(auth).send({
    writingActivityId: activity.id,
    response: 'This response explains the lesson idea with several supporting details.',
    requestKey: 'notification-test-request-01',
  });
  assert.equal(repeated.status, 201);
  assert.equal(repeated.body.data.submissionId, submissionId);
  assert.equal(await WritingSubmission.countDocuments({ user: studentA._id }), 1);
  assert.equal(await Notification.countDocuments({ user: studentA._id, type: 'writing_feedback' }), 1);
  assert.equal(await Notification.countDocuments({ user: studentA._id, type: 'learning_milestone' }), 1);
  assert.equal(await DailyLearningGoal.countDocuments({ user: studentA._id }), 1);
});

test('notifications are newest first, unread counts update, and a student cannot mark another student’s record', async () => {
  const older = await Notification.create({
    user: studentA._id,
    title: 'Older update',
    message: 'An earlier notification.',
    type: 'learning_reminder',
    dedupeKey: 'test:older',
    createdAt: new Date(Date.now() - 60_000),
  });
  const newer = await Notification.create({
    user: studentA._id,
    title: 'Newer update',
    message: 'A later notification.',
    type: 'learning_reminder',
    dedupeKey: 'test:newer',
  });
  const list = await request(app).get('/api/notifications?limit=50').set('Authorization', `Bearer ${tokenA}`);
  assert.equal(list.status, 200);
  const ids = list.body.data.notifications.map((item) => item.id);
  assert.ok(ids.indexOf(String(newer._id)) < ids.indexOf(String(older._id)));
  assert.ok(list.body.data.unreadCount >= 2);

  const forbidden = await request(app).patch(`/api/notifications/${newer.id}/read`).set('Authorization', `Bearer ${tokenB}`);
  assert.equal(forbidden.status, 404);
  const marked = await request(app).patch(`/api/notifications/${newer.id}/read`).set('Authorization', `Bearer ${tokenA}`);
  assert.equal(marked.status, 200);
  assert.equal(marked.body.data.isRead, true);
  const allRead = await request(app).patch('/api/notifications/read-all').set('Authorization', `Bearer ${tokenA}`);
  assert.equal(allRead.status, 200);
  assert.equal(allRead.body.data.unreadCount, 0);
  assert.equal((await request(app).get('/api/notifications/unread-count').set('Authorization', `Bearer ${tokenA}`)).body.data.unreadCount, 0);
});

test('daily goal reminders are created lazily once per reminder period and empty accounts receive none', async () => {
  const noHistory = await request(app).get('/api/notifications').set('Authorization', `Bearer ${tokenB}`);
  assert.equal(noHistory.status, 200);
  assert.equal(noHistory.body.data.notifications.length, 0);

  await DailyLearningGoal.create({
    user: studentB._id,
    dateKey: require('../services/dailyGoalService').getDateKey(),
    targets: { readingLessons: 1, assessments: 1, writingActivities: 1 },
  });
  const first = await request(app).get('/api/notifications').set('Authorization', `Bearer ${tokenB}`);
  const second = await request(app).get('/api/notifications').set('Authorization', `Bearer ${tokenB}`);
  assert.equal(first.body.data.notifications.length, 1);
  assert.equal(second.body.data.notifications.length, 1);
  assert.equal(second.body.data.notifications[0].type, 'learning_reminder');
  assert.equal(await Notification.countDocuments({ user: studentB._id, type: 'learning_reminder' }), 1);
});

test('invalid notification IDs and pagination parameters receive validation errors', async () => {
  const auth = { Authorization: `Bearer ${tokenA}` };
  assert.equal((await request(app).get('/api/notifications?page=0').set(auth)).status, 400);
  assert.equal((await request(app).patch('/api/notifications/not-an-id/read').set(auth)).status, 400);
});

test('a deleted related lesson remains a readable notification with a missing relation instead of breaking the list', async () => {
  const subject = await Subject.findById(lesson.subject);
  const temporaryLesson = await Lesson.create({
    subject: subject._id,
    title: 'Temporary lesson for deleted reference',
    lessonNumber: 2,
    lesson: 'Temporary content for the deleted-reference notification test.',
    contentStatus: 'ready',
    isPublished: true,
  });
  await Notification.create({
    user: studentA._id,
    title: 'Assessment results are ready',
    message: 'Your assessment results are now available.',
    type: 'assessment_result',
    dedupeKey: 'deleted-reference-test',
    relatedRecordId: new mongoose.Types.ObjectId(),
    relatedLesson: temporaryLesson._id,
  });
  await Lesson.deleteOne({ _id: temporaryLesson._id });

  const result = await request(app).get('/api/notifications').set('Authorization', `Bearer ${tokenA}`);
  assert.equal(result.status, 200);
  assert.equal(result.body.data.notifications[0].lesson, null);
  assert.equal(result.body.data.notifications[0].title, 'Assessment results are ready');
});
