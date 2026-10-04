const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { connectDatabase } = require('../config/database');
const { createApp } = require('../app');
const Lesson = require('../models/Lesson');
const LessonSummary = require('../models/LessonSummary');
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
const { createAIService } = require('../services/aiService');

const baseConfig = {
  jwtSecret: 'test-secret-that-is-long-enough-for-stage-six-tests',
  jwtExpiresIn: '1h',
  corsOrigins: [],
};
const configured = {
  apiKey: 'test-provider-key',
  apiUrl: 'https://provider.example/v1/chat/completions',
  model: 'test-model',
  timeoutMs: 1000,
};
const summaryOutput = {
  mainIdea: 'The lesson explains how readers can understand the topic using its central ideas.',
  importantIdeas: ['The lesson introduces essential ideas.', 'Examples help connect the ideas to learning.'],
  importantConcepts: [{ term: 'Central idea', explanation: 'The main point developed by a lesson.' }],
  takeaway: 'Use the lesson’s main ideas to guide your understanding.',
};
const feedbackOutput = {
  strengths: ['You explain the topic in your own words.'],
  areasForImprovement: ['Some supporting points could be connected more clearly.'],
  suggestions: ['Add a transition when moving to your next supporting idea.'],
  encouragement: 'Keep revising; your ideas are taking shape.',
};

let mongoServer;
let studentA;
let studentB;
let tokenA;
let tokenB;
let lessonOne;
let lessonTwo;
let activityOne;
let originalFetch;

function tokenFor(user) {
  return jwt.sign({ sub: user.id }, baseConfig.jwtSecret, {
    expiresIn: '1h',
    issuer: 'readsmart-api',
    audience: 'readsmart-mobile',
  });
}

function providerFetch(output, { status = 200 } = {}) {
  return async (_url, options) => ({
    ok: status >= 200 && status < 300,
    status,
    requestOptions: options,
    async json() {
      return status >= 200 && status < 300
        ? { choices: [{ message: { content: JSON.stringify(output) } }] }
        : { error: { message: 'provider failure' } };
    },
  });
}

async function makeWritingSubmission() {
  const response = Array.from({ length: 10 }, (_value, index) => (
    `Students can examine the lesson ideas and connect each example with the topic number ${index}.`
  )).join(' ');
  return writingService.submitLessonWriting(String(studentA._id), String(lessonOne._id), String(activityOne._id), response);
}

before(async () => {
  originalFetch = global.fetch;
  mongoServer = await MongoMemoryServer.create();
  await connectDatabase(mongoServer.getUri('readsmart_ai_test'));
  await applyReadingSeed();
  await applyMilContentImport();
  await applyUcspContentImport();
  await applyCparContentImport();
  await applyElsContentImport();
  await applyWritingSeed();
  const mil = await Subject.findOne({ code: 'MIL' });
  [lessonOne, lessonTwo] = await Promise.all([
    Lesson.findOne({ subject: mil._id, lessonNumber: 1 }),
    Lesson.findOne({ subject: mil._id, lessonNumber: 2 }),
  ]);
  activityOne = await WritingActivity.findOne({ lesson: lessonOne._id });
  studentA = await User.create({ name: 'AI Student A', email: 'ai-a@example.com', passwordHash: 'test-hash', role: 'student' });
  studentB = await User.create({ name: 'AI Student B', email: 'ai-b@example.com', passwordHash: 'test-hash', role: 'student' });
  tokenA = tokenFor(studentA);
  tokenB = tokenFor(studentB);
});

after(async () => {
  global.fetch = originalFetch;
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test('AI endpoints require authentication and validate lesson/submission IDs', async () => {
  const app = createApp(baseConfig);
  const summaryPath = `/api/lessons/${lessonOne.id}/summary`;
  const feedbackPath = `/api/lessons/${lessonOne.id}/writing/${new mongoose.Types.ObjectId()}/ai-feedback`;
  assert.equal((await request(app).post(summaryPath).send({})).status, 401);
  assert.equal((await request(app).post(feedbackPath).send({})).status, 401);
  assert.equal((await request(app).post('/api/lessons/not-an-id/summary').set({ Authorization: `Bearer ${tokenA}` }).send({})).status, 400);
  assert.equal((await request(app).post(`/api/lessons/${lessonOne.id}/writing/not-an-id/ai-feedback`).set({ Authorization: `Bearer ${tokenA}` }).send({})).status, 400);
  assert.equal((await request(app).post(`/api/lessons/${new mongoose.Types.ObjectId()}/summary`).set({ Authorization: `Bearer ${tokenA}` }).send({})).status, 404);
  assert.equal((await request(app).post(summaryPath).set({ Authorization: `Bearer ${tokenA}` }).send({ lessonContent: 'client content' })).status, 400);
});

test('authenticated students receive a cached summary generated from published lesson content only', async () => {
  let calls = 0;
  global.fetch = async (url, options) => {
    calls += 1;
    assert.equal(url, configured.apiUrl);
    assert.equal(options.headers.Authorization, `Bearer ${configured.apiKey}`);
    const providerBody = JSON.parse(options.body);
    assert.equal(providerBody.model, configured.model);
    const promptText = providerBody.messages[1].content;
    assert.ok(promptText.includes(lessonOne.title));
    assert.ok(!promptText.includes(studentA.email));
    assert.ok(!promptText.includes(tokenA));
    assert.match(providerBody.messages[0].content, /Do not answer or generate comprehension assessment questions/u);
    return providerFetch(summaryOutput)(url, options);
  };

  const app = createApp({ ...baseConfig, ai: configured });
  const endpoint = `/api/lessons/${lessonOne.id}/summary`;
  const first = await request(app).post(endpoint).set({ Authorization: `Bearer ${tokenA}` }).send({});
  assert.equal(first.status, 200);
  assert.deepEqual(first.body.data.summary, summaryOutput);
  assert.equal(first.body.data.cached, false);
  assert.ok(first.body.data.generatedAt);

  const second = await request(app).post(endpoint).set({ Authorization: `Bearer ${tokenB}` }).send({});
  assert.equal(second.status, 200);
  assert.equal(second.body.data.cached, true);
  assert.equal(calls, 1);
  assert.equal(await LessonSummary.countDocuments({ lesson: lessonOne._id }), 1);

  const originalLesson = lessonOne.lesson;
  await Lesson.updateOne({ _id: lessonOne._id }, { $set: { lesson: `${originalLesson} Added source sentence.` } });
  const regenerated = await request(app).post(endpoint).set({ Authorization: `Bearer ${tokenA}` }).send({});
  assert.equal(regenerated.status, 200);
  assert.equal(regenerated.body.data.cached, false);
  assert.equal(calls, 2);
  await Lesson.updateOne({ _id: lessonOne._id }, { $set: { lesson: originalLesson } });

  await Lesson.updateOne({ _id: lessonTwo._id }, { $set: { isPublished: false } });
  try {
    const unpublished = await request(app).post(`/api/lessons/${lessonTwo.id}/summary`).set({ Authorization: `Bearer ${tokenA}` }).send({});
    assert.equal(unpublished.status, 404);
  } finally {
    await Lesson.updateOne({ _id: lessonTwo._id }, { $set: { isPublished: true } });
  }
});

test('missing AI configuration, provider errors, malformed output, and timeouts return controlled fallback errors', async () => {
  const noConfigApp = createApp(baseConfig);
  const noConfig = await request(noConfigApp).post(`/api/lessons/${lessonTwo.id}/summary`).set({ Authorization: `Bearer ${tokenA}` }).send({});
  assert.equal(noConfig.status, 503);
  assert.equal(noConfig.body.error.code, 'AI_SUMMARY_UNAVAILABLE');
  assert.match(noConfig.body.error.message, /continue reading the original lesson/u);

  const app = createApp({ ...baseConfig, ai: configured });
  global.fetch = providerFetch(summaryOutput, { status: 429 });
  const providerError = await request(app).post(`/api/lessons/${lessonTwo.id}/summary`).set({ Authorization: `Bearer ${tokenA}` }).send({});
  assert.equal(providerError.status, 503);

  global.fetch = async () => ({ ok: true, async json() { return { choices: [{ message: { content: '{bad json' } }] }; } });
  const malformed = await request(app).post(`/api/lessons/${lessonTwo.id}/summary`).set({ Authorization: `Bearer ${tokenA}` }).send({});
  assert.equal(malformed.status, 503);
  assert.equal(malformed.body.error.code, 'AI_SUMMARY_UNAVAILABLE');

  global.fetch = (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
    }, { once: true });
  });
  const timeout = await request(createApp({ ...baseConfig, ai: { ...configured, timeoutMs: 1000 } }))
    .post(`/api/lessons/${lessonTwo.id}/summary`).set({ Authorization: `Bearer ${tokenA}` }).send({});
  assert.equal(timeout.status, 503);
});

test('writing feedback is owned, cached, supplementary, and cannot modify the rubric result', async () => {
  const official = await makeWritingSubmission();
  const submissionId = official.submissionId;
  const before = await WritingSubmission.findById(submissionId).lean();
  const app = createApp({ ...baseConfig, ai: configured });
  let calls = 0;
  global.fetch = async (_url, options) => {
    calls += 1;
    const providerBody = JSON.parse(options.body);
    const context = JSON.parse(providerBody.messages[1].content);
    assert.equal(context.writingPrompt, activityOne.prompt);
    assert.equal(context.studentResponse, before.response);
    assert.equal(context.officialRubricResult.totalScore, before.totalScore);
    assert.ok(!providerBody.messages[1].content.includes(studentA.email));
    assert.ok(!providerBody.messages[1].content.includes(tokenA));
    assert.match(providerBody.messages[0].content, /Do not rewrite the submission/u);
    return providerFetch(feedbackOutput)(_url, options);
  };
  const endpoint = `/api/lessons/${lessonOne.id}/writing/${submissionId}/ai-feedback`;
  const first = await request(app).post(endpoint).set({ Authorization: `Bearer ${tokenA}` }).send({});
  assert.equal(first.status, 200);
  assert.deepEqual(first.body.data.feedback, feedbackOutput);
  assert.equal(first.body.data.cached, false);

  const second = await request(app).post(endpoint).set({ Authorization: `Bearer ${tokenA}` }).send({});
  assert.equal(second.status, 200);
  assert.equal(second.body.data.cached, true);
  assert.equal(calls, 1);

  const otherUser = await request(app).post(endpoint).set({ Authorization: `Bearer ${tokenB}` }).send({});
  assert.equal(otherUser.status, 404);
  const wrongLesson = await request(app).post(`/api/lessons/${lessonTwo.id}/writing/${submissionId}/ai-feedback`)
    .set({ Authorization: `Bearer ${tokenA}` }).send({});
  assert.equal(wrongLesson.status, 404);
  assert.equal((await request(app).post(endpoint).send({})).status, 401);
  assert.equal((await request(app).post(endpoint).set({ Authorization: `Bearer ${tokenA}` }).send({ studentResponse: 'inject' })).status, 400);

  const afterSave = await WritingSubmission.findById(submissionId).lean();
  assert.deepEqual(afterSave.aiFeedback, feedbackOutput);
  assert.deepEqual(afterSave.rubricScores, before.rubricScores);
  assert.deepEqual(afterSave.criterionFeedback, before.criterionFeedback);
  assert.equal(afterSave.totalScore, before.totalScore);
  assert.equal(afterSave.maxScore, before.maxScore);
  assert.equal(afterSave.percentage, before.percentage);
  assert.equal(afterSave.feedback, before.feedback);
});

test('writing-feedback failures leave official rubric data untouched and malformed outputs are rejected', async () => {
  const official = await makeWritingSubmission();
  const before = await WritingSubmission.findById(official.submissionId).lean();
  const endpoint = `/api/lessons/${lessonOne.id}/writing/${official.submissionId}/ai-feedback`;

  global.fetch = providerFetch(feedbackOutput, { status: 500 });
  const providerFailure = await request(createApp({ ...baseConfig, ai: configured }))
    .post(endpoint).set({ Authorization: `Bearer ${tokenA}` }).send({});
  assert.equal(providerFailure.status, 503);
  assert.equal(providerFailure.body.error.code, 'AI_FEEDBACK_UNAVAILABLE');

  global.fetch = async () => ({ ok: true, async json() { return { choices: [{ message: { content: JSON.stringify({ strengths: [], areasForImprovement: [], suggestions: [], encouragement: '' }) } }] }; } });
  const malformed = await request(createApp({ ...baseConfig, ai: configured }))
    .post(endpoint).set({ Authorization: `Bearer ${tokenA}` }).send({});
  assert.equal(malformed.status, 503);

  global.fetch = (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
    }, { once: true });
  });
  const timeout = await request(createApp({ ...baseConfig, ai: { ...configured, timeoutMs: 1000 } }))
    .post(endpoint).set({ Authorization: `Bearer ${tokenA}` }).send({});
  assert.equal(timeout.status, 503);
  assert.equal(timeout.body.error.code, 'AI_FEEDBACK_UNAVAILABLE');

  const noConfig = await request(createApp(baseConfig)).post(endpoint).set({ Authorization: `Bearer ${tokenA}` }).send({});
  assert.equal(noConfig.status, 503);

  const afterFailure = await WritingSubmission.findById(official.submissionId).lean();
  assert.deepEqual(afterFailure.rubricScores, before.rubricScores);
  assert.equal(afterFailure.totalScore, before.totalScore);
  assert.equal(afterFailure.percentage, before.percentage);
  assert.equal(afterFailure.feedback, before.feedback);
  assert.equal(afterFailure.aiFeedback, undefined);
});

test('AI output validators reject missing fields and do not require live provider credentials', async () => {
  assert.equal(createAIService(baseConfig).isConfigured, false);
  const service = createAIService({ ai: configured });
  global.fetch = async () => ({ ok: true, async json() { return { choices: [{ message: { content: JSON.stringify({ mainIdea: 'Too little' }) } }] }; } });
  await assert.rejects(() => service.generateLessonSummary({ title: 'test' }), { code: 'AI_SUMMARY_UNAVAILABLE' });
});
