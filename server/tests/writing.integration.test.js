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
const WritingActivity = require('../models/WritingActivity');
const WritingSubmission = require('../models/WritingSubmission');
const { applyReadingSeed } = require('../seed/seedReadingData');
const { applyMilContentImport } = require('../seed/importMilContent');
const { applyUcspContentImport } = require('../seed/importUcspContent');
const { applyCparContentImport } = require('../seed/importCparContent');
const { applyElsContentImport } = require('../seed/importElsContent');
const { applyWritingSeed } = require('../seed/seedWritingActivities');
const writingService = require('../services/writingService');

const config = {
  jwtSecret: 'test-secret-that-is-long-enough-for-writing-tests',
  jwtExpiresIn: '1h',
  corsOrigins: [],
};

let mongoServer;
let app;
let studentA;
let studentB;
let tokenA;
let tokenB;

function createToken(user) {
  return jwt.sign({ sub: user.id }, config.jwtSecret, {
    expiresIn: '1h',
    issuer: 'readsmart-api',
    audience: 'readsmart-mobile',
  });
}

async function getMilLesson(lessonNumber) {
  const subject = await Subject.findOne({ code: 'MIL' });
  return Lesson.findOne({ subject: subject._id, lessonNumber });
}

const sampleResponse = [
  'Media and information literacy helps students evaluate information before they share it with other people.',
  'First, students can check who created a message and whether the source provides evidence for its claims.',
  'For example, comparing two reliable sources can reveal useful context and details that one post may leave out.',
  'Because information can spread quickly online, checking its date, purpose, and accuracy helps readers make careful decisions.',
  'In addition, responsible users should respect privacy and credit creators when they use another person’s ideas.',
  'Overall, these habits support informed decisions and more responsible communication at school and in the community.',
  'These steps do not mean every message is false; they help readers decide what is supported, what remains uncertain, and what should not be shared without checking.',
].join(' ');

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await connectDatabase(mongoServer.getUri('readsmart_writing_test'));
  await applyReadingSeed();
  await applyMilContentImport();
  await applyUcspContentImport();
  await applyCparContentImport();
  await applyElsContentImport();
  await applyWritingSeed();
  app = createApp(config);
  studentA = await User.create({
    name: 'Writing Student A',
    email: 'writing-a@example.com',
    passwordHash: 'not-used-by-this-test',
    role: 'student',
  });
  studentB = await User.create({
    name: 'Writing Student B',
    email: 'writing-b@example.com',
    passwordHash: 'not-used-by-this-test',
    role: 'student',
  });
  tokenA = createToken(studentA);
  tokenB = createToken(studentB);
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test('writing activity seed creates 40 unique published activities idempotently', async () => {
  const originalIds = new Map((await WritingActivity.find().select('_id lesson').lean())
    .map(({ _id, lesson }) => [String(lesson), String(_id)]));
  const first = await applyWritingSeed();
  const second = await applyWritingSeed();
  assert.equal(first.activityCount, 40);
  assert.equal(first.publishedCount, 40);
  assert.equal(first.lessonCount, 40);
  assert.deepEqual(first.counts, { MIL: 10, UCSP: 10, CPAR: 10, ELS: 10 });
  assert.deepEqual(first, second);
  assert.equal(await WritingActivity.countDocuments(), 40);
  const activities = await WritingActivity.find().lean();
  assert.equal(activities.length, 40);
  assert.ok(activities.every(({ isPublished, criteria, minimumWords, maximumWords }) => (
    isPublished && criteria.length === 5 && minimumWords === 100 && maximumWords === 250
  )));
  for (const activity of activities) assert.equal(String(activity._id), originalIds.get(String(activity.lesson)));
  for (const code of ['MIL', 'UCSP', 'CPAR', 'ELS']) {
    const subject = await Subject.findOne({ code });
    const lessons = await Lesson.find({ subject: subject._id }).select('_id').lean();
    assert.equal(await WritingActivity.countDocuments({ lesson: { $in: lessons.map(({ _id }) => _id) } }), 10);
  }
});

test('authenticated students retrieve the published activity for its lesson only', async () => {
  const lesson = await getMilLesson(1);
  const activity = await WritingActivity.findOne({ lesson: lesson._id });
  const response = await request(app)
    .get('/api/lessons/' + lesson.id + '/writing')
    .set({ Authorization: 'Bearer ' + tokenA });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.activity.id, String(activity._id));
  assert.equal(response.body.data.activity.lessonId, String(lesson._id));
  assert.equal(response.body.data.activity.lessonTitle, lesson.title);
  assert.equal(response.body.data.activity.title, activity.title);
  assert.equal(response.body.data.activity.criteria.length, 5);
  assert.equal(Object.hasOwn(response.body.data.activity, '__v'), false);

  const unauthenticated = await request(app).get('/api/lessons/' + lesson.id + '/writing');
  assert.equal(unauthenticated.status, 401);
  const invalidId = await request(app).get('/api/lessons/not-an-id/writing').set({ Authorization: 'Bearer ' + tokenA });
  assert.equal(invalidId.status, 400);
  const missingLessonId = await request(app).get('/api/lessons//writing').set({ Authorization: 'Bearer ' + tokenA });
  assert.equal(missingLessonId.status, 404);
  const missingLesson = await request(app).get('/api/lessons/000000000000000000000001/writing').set({ Authorization: 'Bearer ' + tokenA });
  assert.equal(missingLesson.status, 404);
});

test('subject-to-lesson writing flow resolves and accepts one writing submission for every subject', async () => {
  const flowStudent = await User.create({
    name: 'Writing Flow Student',
    email: 'writing-flow@example.com',
    passwordHash: 'not-used-by-this-test',
    role: 'student',
  });
  const flowToken = createToken(flowStudent);
  const subjectsResponse = await request(app)
    .get('/api/subjects')
    .set({ Authorization: 'Bearer ' + flowToken });
  assert.equal(subjectsResponse.status, 200);
  assert.deepEqual(subjectsResponse.body.data.subjects.map((subject) => subject.code), ['MIL', 'UCSP', 'CPAR', 'ELS']);

  for (const subject of subjectsResponse.body.data.subjects) {
    const lessonsResponse = await request(app)
      .get('/api/subjects/' + subject.id + '/lessons')
      .set({ Authorization: 'Bearer ' + flowToken });
    assert.equal(lessonsResponse.status, 200);
    assert.equal(lessonsResponse.body.data.lessons.length, 10);

    const lesson = lessonsResponse.body.data.lessons[0];
    const activityResponse = await request(app)
      .get('/api/lessons/' + lesson.id + '/writing')
      .set({ Authorization: 'Bearer ' + flowToken });
    assert.equal(activityResponse.status, 200);
    assert.equal(activityResponse.body.data.activity.lessonId, lesson.id);

    const submissionResponse = await request(app)
      .post('/api/lessons/' + lesson.id + '/writing')
      .set({ Authorization: 'Bearer ' + flowToken })
      .send({
        writingActivityId: activityResponse.body.data.activity.id,
        response: sampleResponse,
      });
    assert.equal(submissionResponse.status, 201);
    assert.equal(submissionResponse.body.data.lesson.id, lesson.id);
    assert.equal(submissionResponse.body.data.writingActivity.id, activityResponse.body.data.activity.id);
    assert.equal(submissionResponse.body.data.maxScore, 25);
  }
});

test('unpublished activities are not returned to students', async () => {
  const lesson = await getMilLesson(1);
  const activity = await WritingActivity.findOne({ lesson: lesson._id });
  await WritingActivity.updateOne({ _id: activity._id }, { $set: { isPublished: false } });
  try {
    const response = await request(app)
      .get('/api/lessons/' + lesson.id + '/writing')
      .set({ Authorization: 'Bearer ' + tokenA });
    assert.equal(response.status, 404);
    assert.equal(response.body.error.code, 'WRITING_ACTIVITY_NOT_FOUND');
  } finally {
    await WritingActivity.updateOne({ _id: activity._id }, { $set: { isPublished: true } });
  }
});

test('writing submission rejects invalid, empty, out-of-range, and client-scored requests', async () => {
  const lesson = await getMilLesson(1);
  const activity = await WritingActivity.findOne({ lesson: lesson._id });
  const endpoint = '/api/lessons/' + lesson.id + '/writing';
  const auth = { Authorization: 'Bearer ' + tokenA };
  const post = (body, path = endpoint, headers = auth) => request(app).post(path).set(headers).send(body);

  assert.equal((await request(app).post(endpoint).send({ writingActivityId: String(activity._id), response: sampleResponse })).status, 401);
  assert.equal((await request(app).get('/api/lessons/' + lesson.id + '/writing-submissions')).status, 401);
  assert.equal((await post({ response: sampleResponse })).status, 400, 'writingActivityId is required.');
  assert.equal((await post({ writingActivityId: 'invalid', response: sampleResponse })).status, 400);
  assert.equal((await post({ writingActivityId: String(activity._id) })).status, 400, 'response is required.');
  assert.equal((await post({ writingActivityId: String(activity._id), response: '' })).status, 400);
  assert.equal((await post({ writingActivityId: String(activity._id), response: '   ' })).status, 400);
  assert.equal((await post({ writingActivityId: String(activity._id), response: Array(99).fill('word').join(' ') })).status, 400);
  assert.equal((await post({ writingActivityId: String(activity._id), response: Array(251).fill('word').join(' ') })).status, 400);
  const malformed = await request(app)
    .post(endpoint)
    .set(auth)
    .set('Content-Type', 'application/json')
    .send('{"writingActivityId":');
  assert.equal(malformed.status, 400);
  assert.equal((await post({ writingActivityId: '000000000000000000000001', response: sampleResponse })).status, 404);

  const otherLesson = await getMilLesson(2);
  const otherActivity = await WritingActivity.findOne({ lesson: otherLesson._id });
  const mismatched = await post({ writingActivityId: String(otherActivity._id), response: sampleResponse });
  assert.equal(mismatched.status, 404);

  const injectedResults = [
    { rubricScores: { grammar: 5, vocabulary: 5, organization: 5, coherence: 5, developmentOfIdeas: 5 } },
    { totalScore: 25 },
    { percentage: 100 },
    { feedback: 'Injected feedback' },
  ];
  for (const injected of injectedResults) {
    const rejected = await post({ writingActivityId: String(activity._id), response: sampleResponse, ...injected });
    assert.equal(rejected.status, 400);
  }

  const admin = await User.create({
    name: 'Writing Test Admin',
    email: 'writing-admin@example.com',
    passwordHash: 'not-used-by-this-test',
    role: 'admin',
  });
  const adminResponse = await post(
    { writingActivityId: String(activity._id), response: sampleResponse },
    endpoint,
    { Authorization: 'Bearer ' + createToken(admin) },
  );
  assert.equal(adminResponse.status, 403);
});

test('backend counts and scores a valid response deterministically, then saves private attempts', async () => {
  const lesson = await getMilLesson(1);
  const activity = await WritingActivity.findOne({ lesson: lesson._id });
  const endpoint = '/api/lessons/' + lesson.id + '/writing';
  const expectedWordCount = sampleResponse.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu).length;
  assert.ok(expectedWordCount >= activity.minimumWords && expectedWordCount <= activity.maximumWords);
  const response = await request(app)
    .post(endpoint)
    .set({ Authorization: 'Bearer ' + tokenA })
    .send({ writingActivityId: String(activity._id), response: sampleResponse });
  assert.equal(response.status, 201);
  const result = response.body.data;
  assert.equal(result.wordCount, expectedWordCount);
  assert.deepEqual(Object.keys(result.rubricScores).sort(), ['coherence', 'developmentOfIdeas', 'grammar', 'organization', 'vocabulary'].sort());
  assert.ok(Object.values(result.rubricScores).every((score) => Number.isInteger(score) && score >= 1 && score <= 5));
  assert.equal(result.totalScore, Object.values(result.rubricScores).reduce((sum, score) => sum + score, 0));
  assert.equal(result.maxScore, 25);
  assert.equal(result.percentage, Math.round((result.totalScore / 25) * 100));
  assert.ok(result.feedback.length > 0);
  assert.ok(Object.values(result.criterionFeedback).every((feedback) => typeof feedback === 'string' && feedback.length > 0));

  const repeated = await request(app)
    .post(endpoint)
    .set({ Authorization: 'Bearer ' + tokenA })
    .send({ writingActivityId: String(activity._id), response: sampleResponse });
  assert.equal(repeated.status, 201);
  assert.deepEqual(repeated.body.data.rubricScores, result.rubricScores);
  assert.equal(repeated.body.data.totalScore, result.totalScore);

  const stored = await WritingSubmission.findById(result.submissionId).lean();
  assert.ok(stored);
  assert.equal(String(stored.user), String(studentA._id));
  assert.equal(String(stored.lesson), String(lesson._id));
  assert.equal(String(stored.writingActivity), String(activity._id));
  assert.equal(stored.wordCount, expectedWordCount);
  assert.deepEqual(stored.rubricScores, result.rubricScores);
  assert.equal(stored.totalScore, result.totalScore);
  assert.equal(stored.percentage, result.percentage);

  const own = await request(app)
    .get('/api/lessons/' + lesson.id + '/writing-submissions')
    .set({ Authorization: 'Bearer ' + tokenA });
  const otherStudent = await request(app)
    .get('/api/lessons/' + lesson.id + '/writing-submissions')
    .set({ Authorization: 'Bearer ' + tokenB });
  assert.equal(own.status, 200);
  assert.equal(own.body.data.submissions.length, 2);
  assert.equal(otherStudent.status, 200);
  assert.equal(otherStudent.body.data.submissions.length, 0);

  const activityList = await request(app).get('/api/writing/activities').set({ Authorization: 'Bearer ' + tokenA });
  assert.equal(activityList.status, 200);
  const lessonRow = activityList.body.data.activities.find((entry) => entry.lesson.id === lesson.id);
  assert.equal(lessonRow.submitted, true);
  assert.equal(lessonRow.latestResult.percentage, result.percentage);
});

test('word counter follows the documented Unicode and hyphenated-word rule', () => {
  assert.equal(writingService.countWords('Earth-life systems include 3 connected spheres and a learner’s example.'), 10);
});
