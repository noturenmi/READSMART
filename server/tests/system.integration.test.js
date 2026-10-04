const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { connectDatabase } = require('../config/database');
const { createApp } = require('../app');
const AssessmentAttempt = require('../models/AssessmentAttempt');
const Lesson = require('../models/Lesson');
const ReadingQuestion = require('../models/ReadingQuestion');
const Subject = require('../models/Subject');
const WritingActivity = require('../models/WritingActivity');
const WritingSubmission = require('../models/WritingSubmission');
const { applyReadingSeed } = require('../seed/seedReadingData');
const { applyMilContentImport } = require('../seed/importMilContent');
const { applyUcspContentImport } = require('../seed/importUcspContent');
const { applyCparContentImport } = require('../seed/importCparContent');
const { applyElsContentImport } = require('../seed/importElsContent');
const elsLessons = require('../seed/earthLifeScienceLessons.json');
const { applyAssessmentSeed } = require('../seed/seedAssessmentData');
const { applyWritingSeed } = require('../seed/seedWritingActivities');

const config = {
  jwtSecret: 'test-secret-that-is-long-enough-for-system-integration',
  jwtExpiresIn: '1h',
  corsOrigins: [],
  ai: {
    apiKey: 'mock-provider-key',
    apiUrl: 'https://provider.example/v1/chat/completions',
    model: 'mock-model',
    timeoutMs: 1000,
  },
};

const summary = {
  mainIdea: 'This lesson develops its central topic through explanations and examples.',
  importantIdeas: ['The lesson presents supporting ideas.', 'Examples connect those ideas to the topic.'],
  importantConcepts: [{ term: 'Central idea', explanation: 'The main point developed in a lesson.' }],
  takeaway: 'Use the main ideas and supporting details to understand the lesson.',
};
const writingFeedback = {
  strengths: ['You explain the topic in your own words.'],
  areasForImprovement: ['Connect each supporting point clearly.'],
  suggestions: ['Add transitions between related ideas.'],
  encouragement: 'Keep revising; your ideas are developing.',
};

let mongoServer;
let app;
let originalFetch;
let providerOutput;

before(async () => {
  originalFetch = global.fetch;
  mongoServer = await MongoMemoryServer.create();
  await connectDatabase(mongoServer.getUri('readsmart_system_test'));
  await applyReadingSeed();
  await applyMilContentImport();
  await applyUcspContentImport();
  await applyCparContentImport();
  await applyElsContentImport();
  await applyAssessmentSeed();
  await applyWritingSeed();
  app = createApp(config);
});

after(async () => {
  global.fetch = originalFetch;
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test('configured browser CORS origins are allowed while native-style requests reach authentication', async () => {
  const corsApp = createApp({ ...config, corsOrigins: ['https://readsmart.example'] });
  const allowed = await request(corsApp)
    .options('/api/auth/me')
    .set('Origin', 'https://readsmart.example')
    .set('Access-Control-Request-Method', 'GET');
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers['access-control-allow-origin'], 'https://readsmart.example');

  const rejectedOrigin = await request(corsApp)
    .options('/api/auth/me')
    .set('Origin', 'https://untrusted.example')
    .set('Access-Control-Request-Method', 'GET');
  assert.equal(rejectedOrigin.status, 204);
  assert.equal(rejectedOrigin.headers['access-control-allow-origin'], undefined);

  const nativeStyleRequest = await request(corsApp).get('/api/auth/me');
  assert.equal(nativeStyleRequest.status, 401);
});

test('catalog lesson sections are complete and a student completes reading, writing, AI, and progress flow', async () => {
  const [subjectCount, publishedLessonCount, questionCount, publishedWritingCount] = await Promise.all([
    Subject.countDocuments({ isActive: true }),
    Lesson.countDocuments({ isPublished: true, contentStatus: 'ready' }),
    ReadingQuestion.countDocuments({ isPublished: true }),
    WritingActivity.countDocuments({ isPublished: true }),
  ]);
  assert.equal(subjectCount, 4);
  assert.equal(publishedLessonCount, 40);
  assert.equal(questionCount, 200);
  assert.equal(publishedWritingCount, 40);

  const [lessons, subjects, publishedQuestions, publishedActivities] = await Promise.all([
    Lesson.find({ isPublished: true, contentStatus: 'ready' }).select('_id subject lessonNumber title lesson discussion example keyConcepts keyTakeaway').lean(),
    Subject.find().select('_id code').lean(),
    ReadingQuestion.find({ isPublished: true }).select('lesson').lean(),
    WritingActivity.find({ isPublished: true }).select('lesson').lean(),
  ]);
  assert.equal(lessons.length, 40);
  const subjectCodeById = new Map(subjects.map((subject) => [String(subject._id), subject.code]));
  const questionsByLesson = new Map();
  const activitiesByLesson = new Map();
  for (const question of publishedQuestions) {
    const key = String(question.lesson);
    questionsByLesson.set(key, (questionsByLesson.get(key) || 0) + 1);
  }
  for (const activity of publishedActivities) {
    const key = String(activity.lesson);
    activitiesByLesson.set(key, (activitiesByLesson.get(key) || 0) + 1);
  }
  const incompleteLessons = [];
  for (const lesson of lessons) {
    const missing = [];
    if (!lesson.lesson.trim()) missing.push('lesson');
    if (!lesson.discussion.trim()) missing.push('discussion');
    if (!lesson.example.trim()) missing.push('example');
    if (!lesson.keyConcepts.length) missing.push('keyConcepts');
    if (!lesson.keyTakeaway.trim()) missing.push('keyTakeaway');
    if (questionsByLesson.get(String(lesson._id)) !== 5) missing.push('five published questions');
    if (activitiesByLesson.get(String(lesson._id)) !== 1) missing.push('one published writing activity');
    if (missing.length) {
      incompleteLessons.push(`${subjectCodeById.get(String(lesson.subject))}:${lesson.lessonNumber} ${lesson.title} [${missing.join(', ')}]`);
    }
  }
  assert.deepEqual(incompleteLessons, [], 'All published lessons need their required reading sections and activities.');
  const els = subjects.find(({ code }) => code === 'ELS');
  for (const lessonNumber of [9, 10]) {
    const stored = lessons.find((lesson) => String(lesson.subject) === String(els._id)
      && lesson.lessonNumber === lessonNumber);
    const supplied = elsLessons.find((lesson) => lesson.lessonNumber === lessonNumber);
    assert.ok(stored.discussion.trim().length > 200, `ELS lesson ${lessonNumber} needs a complete Discussion section.`);
    assert.notEqual(stored.discussion, stored.lesson, `ELS lesson ${lessonNumber} Discussion must not duplicate its Lesson section.`);
    assert.equal(stored.discussion, supplied.discussion, `ELS lesson ${lessonNumber} Discussion must match its seed source.`);
  }

  global.fetch = async () => ({
    ok: true,
    async json() {
      return { choices: [{ message: { content: JSON.stringify(providerOutput) } }] };
    },
  });

  const registration = await request(app).post('/api/auth/register').send({
    name: 'System Test Student',
    email: 'system-student@example.test',
    password: 'safe-system-test-password-2026',
  });
  assert.equal(registration.status, 201);
  const token = registration.body.data.token;
  const auth = { Authorization: `Bearer ${token}` };

  const subjectResponse = await request(app).get('/api/subjects').set(auth);
  assert.equal(subjectResponse.status, 200);
  assert.equal(subjectResponse.body.data.subjects.length, 4);
  const mil = subjectResponse.body.data.subjects.find(({ code }) => code === 'MIL');
  assert.ok(mil);

  const lessonsResponse = await request(app).get(`/api/subjects/${mil.id}/lessons`).set(auth);
  assert.equal(lessonsResponse.status, 200);
  assert.equal(lessonsResponse.body.data.lessons.length, 10);
  const firstLesson = lessonsResponse.body.data.lessons[0];
  assert.equal(firstLesson.lessonNumber, 1);

  const lessonResponse = await request(app).get(`/api/lessons/${firstLesson.id}`).set(auth);
  assert.equal(lessonResponse.status, 200);
  assert.ok(lessonResponse.body.data.lesson.lesson);

  providerOutput = summary;
  const summaryResponse = await request(app).post(`/api/lessons/${firstLesson.id}/summary`).set(auth).send({});
  assert.equal(summaryResponse.status, 200);
  assert.equal(summaryResponse.body.data.summary.mainIdea, summary.mainIdea);

  const questionResponse = await request(app).get(`/api/lessons/${firstLesson.id}/questions`).set(auth);
  assert.equal(questionResponse.status, 200);
  assert.equal(questionResponse.body.data.questions.length, 5);
  assert.ok(questionResponse.body.data.questions.every((question) => !Object.hasOwn(question, 'correctAnswer')));
  const answerKey = await ReadingQuestion.find({ lesson: firstLesson.id, isPublished: true })
    .select('+correctAnswer')
    .sort({ order: 1 })
    .lean();
  const assessmentResponse = await request(app)
    .post(`/api/lessons/${firstLesson.id}/assessment`)
    .set(auth)
    .send({ answers: answerKey.map(({ _id, correctAnswer }) => ({ questionId: String(_id), selectedAnswer: correctAnswer })) });
  assert.equal(assessmentResponse.status, 201);
  assert.equal(assessmentResponse.body.data.score, assessmentResponse.body.data.totalPoints);
  assert.equal(assessmentResponse.body.data.percentage, 100);
  assert.equal(await AssessmentAttempt.countDocuments({ lesson: firstLesson.id }), 1);

  const writingActivityResponse = await request(app).get(`/api/lessons/${firstLesson.id}/writing`).set(auth);
  assert.equal(writingActivityResponse.status, 200);
  const writingActivity = writingActivityResponse.body.data.activity;
  assert.equal(writingActivity.lessonId, firstLesson.id);
  const response = Array.from({ length: 12 }, (_value, index) => (
    `In this lesson students examine important ideas and support each explanation with clear examples and details ${index + 1}.`
  )).join(' ');
  const writingResponse = await request(app)
    .post(`/api/lessons/${firstLesson.id}/writing`)
    .set(auth)
    .send({ writingActivityId: writingActivity.id, response });
  assert.equal(writingResponse.status, 201);
  assert.ok(writingResponse.body.data.wordCount >= writingActivity.minimumWords);
  assert.ok(writingResponse.body.data.wordCount <= writingActivity.maximumWords);
  assert.equal(await WritingSubmission.countDocuments({ lesson: firstLesson.id }), 1);

  providerOutput = writingFeedback;
  const aiFeedbackResponse = await request(app)
    .post(`/api/lessons/${firstLesson.id}/writing/${writingResponse.body.data.submissionId}/ai-feedback`)
    .set(auth)
    .send({});
  assert.equal(aiFeedbackResponse.status, 200);
  assert.deepEqual(aiFeedbackResponse.body.data.feedback, writingFeedback);

  const progressResponse = await request(app).get('/api/progress/me').set(auth);
  assert.equal(progressResponse.status, 200);
  assert.equal(progressResponse.body.data.totalXP, 45);
  assert.equal(progressResponse.body.data.level, 1);
  assert.equal(progressResponse.body.data.readingAssessmentsCompleted, 1);
  assert.equal(progressResponse.body.data.writingActivitiesCompleted, 1);
  assert.equal(progressResponse.body.data.lessonsCompleted, 1);
  assert.equal(progressResponse.body.data.overallProgressPercentage, 2.5);

  const storedWriting = await WritingSubmission.findById(writingResponse.body.data.submissionId).lean();
  assert.equal(storedWriting.totalScore, writingResponse.body.data.totalScore);
  assert.equal(storedWriting.percentage, writingResponse.body.data.percentage);
  assert.equal(await AssessmentAttempt.countDocuments({ lesson: firstLesson.id }), 1);
});
