const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { connectDatabase } = require('../config/database');
const { createApp } = require('../app');
const AssessmentAttempt = require('../models/AssessmentAttempt');
const ActivityRecord = require('../models/ActivityRecord');
const Lesson = require('../models/Lesson');
const ReadingQuestion = require('../models/ReadingQuestion');
const Subject = require('../models/Subject');
const User = require('../models/User');
const { hashPassword } = require('../utils/password');
const { applyReadingSeed } = require('../seed/seedReadingData');
const { applyMilContentImport } = require('../seed/importMilContent');
const { applyUcspContentImport } = require('../seed/importUcspContent');
const { applyCparContentImport } = require('../seed/importCparContent');
const { applyElsContentImport } = require('../seed/importElsContent');
const { applyAssessmentSeed } = require('../seed/seedAssessmentData');

const config = {
  jwtSecret: 'test-secret-that-is-long-enough-for-jwt-testing',
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

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await connectDatabase(mongoServer.getUri('readsmart_assessment_test'));
  await applyReadingSeed();
  await applyMilContentImport();
  await applyUcspContentImport();
  await applyCparContentImport();
  await applyElsContentImport();
  app = createApp(config);
  studentA = await User.create({
    name: 'Assessment Student A',
    email: 'assessment-a@example.com',
    passwordHash: await hashPassword('test-password-41'),
    role: 'student',
  });
  studentB = await User.create({
    name: 'Assessment Student B',
    email: 'assessment-b@example.com',
    passwordHash: await hashPassword('test-password-42'),
    role: 'student',
  });
  tokenA = createToken(studentA);
  tokenB = createToken(studentB);
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test('assessment seed creates five balanced questions per published lesson idempotently', async () => {
  const first = await applyAssessmentSeed();
  const firstIds = new Map(
    (await ReadingQuestion.find().select('_id lesson order').lean())
      .map(({ _id, lesson, order }) => [`${lesson}:${order}`, String(_id)]),
  );
  const second = await applyAssessmentSeed();
  assert.deepEqual(first, second);
  assert.equal(first.subjectCount, 4);
  assert.equal(first.lessonCount, 40);
  assert.equal(first.questionCount, 200);
  assert.deepEqual(first.counts, { MIL: 50, UCSP: 50, CPAR: 50, ELS: 50 });
  assert.equal(await ReadingQuestion.countDocuments(), 200);

  for (const code of ['MIL', 'UCSP', 'CPAR', 'ELS']) {
    const subject = await Subject.findOne({ code });
    const lessons = await Lesson.find({ subject: subject._id }).select('_id').lean();
    assert.equal(lessons.length, 10);
    for (const lesson of lessons) {
      const questions = await ReadingQuestion.find({ lesson: lesson._id }).sort({ order: 1 }).lean();
      assert.equal(questions.length, 5);
      assert.deepEqual(questions.map(({ questionType }) => questionType), [
        'key_idea', 'vocabulary', 'inference', 'interpretation', 'evaluation',
      ]);
      assert.ok(questions.every(({ isPublished, points, choices }) => isPublished && points === 1 && choices.length === 4));
      for (const question of questions) assert.equal(String(question._id), firstIds.get(`${lesson._id}:${question.order}`));
    }
  }
  assert.equal(await Lesson.countDocuments({ isPublished: true, contentStatus: 'ready' }), 40);
});

test('student retrieves only published questions for a lesson without correct answers', async () => {
  const auth = { Authorization: `Bearer ${tokenA}` };
  const mil = await Subject.findOne({ code: 'MIL' });
  const lesson = await Lesson.findOne({ subject: mil._id, lessonNumber: 1 });
  const otherLesson = await Lesson.findOne({ subject: mil._id, lessonNumber: 2 });
  const otherQuestion = await ReadingQuestion.findOne({ lesson: otherLesson._id });
  const draft = await ReadingQuestion.create({
    lesson: lesson._id,
    question: 'Draft-only question for the published filter check?',
    questionType: 'key_idea',
    choices: ['First option', 'Second option', 'Third option', 'Fourth option'],
    correctAnswer: 0,
    explanation: 'This draft must not be visible to students.',
    points: 1,
    order: 6,
    isPublished: false,
  });
  try {
    const unauthenticated = await request(app).get(`/api/lessons/${lesson.id}/questions`);
    assert.equal(unauthenticated.status, 401);
    const response = await request(app).get(`/api/lessons/${lesson.id}/questions`).set(auth);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.lesson.id, lesson.id);
    assert.equal(response.body.data.questions.length, 5);
    assert.ok(response.body.data.questions.every((question) => question.lessonId === undefined));
    assert.equal(response.body.data.questions.some(({ id }) => id === String(draft._id)), false);
    assert.equal(response.body.data.questions.some(({ id }) => id === String(otherQuestion._id)), false);
    for (const question of response.body.data.questions) {
      assert.equal(question.choices.length, 4);
      assert.equal(Object.hasOwn(question, 'correctAnswer'), false);
      assert.equal(Object.hasOwn(question, 'explanation'), false);
    }
  } finally {
    await ReadingQuestion.deleteOne({ _id: draft._id });
  }
});

test('submission is server-scored, saved, and attempt history is private to the student', async () => {
  const mil = await Subject.findOne({ code: 'MIL' });
  const lesson = await Lesson.findOne({ subject: mil._id, lessonNumber: 1 });
  const questions = await ReadingQuestion.find({ lesson: lesson._id, isPublished: true })
    .select('+correctAnswer')
    .sort({ order: 1 })
    .lean();
  const answers = questions.map((question, index) => ({
    questionId: String(question._id),
    selectedAnswer: index < 3 ? question.correctAnswer : (question.correctAnswer + 1) % 4,
  }));

  const unauthenticated = await request(app).post(`/api/lessons/${lesson.id}/assessment`).send({ answers });
  assert.equal(unauthenticated.status, 401);
  const response = await request(app).post(`/api/lessons/${lesson.id}/assessment`).set({ Authorization: `Bearer ${tokenA}` }).send({
    answers,
    score: 5,
    percentage: 100,
  });
  assert.equal(response.status, 400, 'Client-supplied score fields must be rejected.');

  const submitted = await request(app)
    .post(`/api/lessons/${lesson.id}/assessment`)
    .set({ Authorization: `Bearer ${tokenA}` })
    .send({ answers });
  assert.equal(submitted.status, 201);
  const result = submitted.body.data;
  assert.equal(result.score, 3);
  assert.equal(result.totalItems, 5);
  assert.equal(result.totalPoints, 5);
  assert.equal(result.percentage, 60);
  assert.equal(result.feedback, 'You have a developing understanding of the lesson. Review the material and try again.');
  assert.equal(result.answers.filter(({ isCorrect }) => isCorrect).length, 3);
  assert.ok(result.answers.every(({ explanation }) => typeof explanation === 'string' && explanation.length > 0));
  assert.equal(Object.hasOwn(result.answers[0], 'correctAnswer'), false);

  const stored = await AssessmentAttempt.findById(result.attemptId).lean();
  assert.ok(stored);
  assert.equal(String(stored.user), String(studentA._id));
  assert.equal(String(stored.lesson), String(lesson._id));
  assert.equal(stored.score, 3);
  assert.equal(stored.totalItems, 5);
  assert.equal(stored.totalPoints, 5);
  assert.equal(stored.percentage, 60);
  assert.equal(stored.answers.filter(({ isCorrect }) => isCorrect).length, 3);

  const studentBSubmit = await request(app)
    .post(`/api/lessons/${lesson.id}/assessment`)
    .set({ Authorization: `Bearer ${tokenB}` })
    .send({ answers });
  assert.equal(studentBSubmit.status, 201);
  const attemptResponseA = await request(app)
    .get(`/api/lessons/${lesson.id}/assessment-attempts`)
    .set({ Authorization: `Bearer ${tokenA}` });
  const attemptResponseB = await request(app)
    .get(`/api/lessons/${lesson.id}/assessment-attempts`)
    .set({ Authorization: `Bearer ${tokenB}` });
  assert.equal(attemptResponseA.status, 200);
  assert.equal(attemptResponseB.status, 200);
  assert.equal(attemptResponseA.body.data.attempts.length, 1);
  assert.equal(attemptResponseB.body.data.attempts.length, 1);
  assert.equal(attemptResponseA.body.data.attempts[0].id, result.attemptId);
  assert.notEqual(attemptResponseA.body.data.attempts[0].id, studentBSubmit.body.data.attemptId);
  assert.equal(Object.hasOwn(attemptResponseA.body.data.attempts[0].answers[0], 'correctAnswer'), false);
  assert.equal(Object.hasOwn(attemptResponseA.body.data.attempts[0].answers[0], 'choices'), false);
  assert.equal((await request(app).get(`/api/lessons/${lesson.id}/assessment-attempts`)).status, 401);
});

test('assessment submission rejects missing, invalid, duplicate, and foreign question answers', async () => {
  const auth = { Authorization: `Bearer ${tokenA}` };
  const mil = await Subject.findOne({ code: 'MIL' });
  const lesson = await Lesson.findOne({ subject: mil._id, lessonNumber: 1 });
  const otherLesson = await Lesson.findOne({ subject: mil._id, lessonNumber: 2 });
  const questions = await ReadingQuestion.find({ lesson: lesson._id }).sort({ order: 1 }).lean();
  const otherQuestion = await ReadingQuestion.findOne({ lesson: otherLesson._id });
  const complete = questions.map(({ _id }) => ({ questionId: String(_id), selectedAnswer: 0 }));

  const missing = await request(app).post(`/api/lessons/${lesson.id}/assessment`).set(auth).send({ answers: complete.slice(0, 4) });
  assert.equal(missing.status, 400);
  assert.equal(missing.body.error.code, 'MISSING_ANSWERS');
  const invalidChoice = await request(app).post(`/api/lessons/${lesson.id}/assessment`).set(auth).send({ answers: complete.map((answer, index) => index === 0 ? { ...answer, selectedAnswer: 4 } : answer) });
  assert.equal(invalidChoice.status, 400);
  const duplicate = await request(app).post(`/api/lessons/${lesson.id}/assessment`).set(auth).send({ answers: complete.map((answer, index) => index === 1 ? { ...answer, questionId: complete[0].questionId } : answer) });
  assert.equal(duplicate.status, 400);
  assert.equal(duplicate.body.error.code, 'DUPLICATE_QUESTION');
  const foreign = await request(app).post(`/api/lessons/${lesson.id}/assessment`).set(auth).send({ answers: complete.map((answer, index) => index === 0 ? { ...answer, questionId: String(otherQuestion._id) } : answer) });
  assert.equal(foreign.status, 404);
  assert.equal(foreign.body.error.code, 'QUESTION_NOT_FOUND');
  const malformed = await request(app).post(`/api/lessons/${lesson.id}/assessment`).set(auth).send({ answers: complete.map((answer, index) => index === 0 ? { ...answer, questionId: 'not-an-id' } : answer) });
  assert.equal(malformed.status, 400);
  const badLesson = await request(app).get('/api/lessons/not-an-id/questions').set(auth);
  assert.equal(badLesson.status, 400);
});

test('student can review incorrect answers from their completed attempt without exposing answers early or awarding more XP', async () => {
  const mil = await Subject.findOne({ code: 'MIL' });
  const lesson = await Lesson.findOne({ subject: mil._id, lessonNumber: 1 });
  const questions = await ReadingQuestion.find({ lesson: lesson._id, isPublished: true })
    .select('+correctAnswer')
    .sort({ order: 1 })
    .lean();
  const answers = questions.map((question, index) => ({
    questionId: String(question._id),
    selectedAnswer: index === 1 ? (question.correctAnswer + 1) % 4 : question.correctAnswer,
  }));
  const submitted = await request(app)
    .post(`/api/lessons/${lesson.id}/assessment`)
    .set({ Authorization: `Bearer ${tokenA}` })
    .send({ answers });
  assert.equal(submitted.status, 201);

  const publicQuestions = await request(app)
    .get(`/api/lessons/${lesson.id}/questions`)
    .set({ Authorization: `Bearer ${tokenA}` });
  assert.equal(publicQuestions.status, 200);
  assert.ok(publicQuestions.body.data.questions.every((question) => !Object.hasOwn(question, 'correctAnswer')));
  assert.ok(publicQuestions.body.data.questions.every((question) => !Object.hasOwn(question, 'explanation')));

  const activityCount = await ActivityRecord.countDocuments({ user: studentA._id, activityType: 'reading_assessment', lesson: lesson._id });
  const reviewPath = `/api/lessons/${lesson.id}/assessment-attempts/${submitted.body.data.attemptId}/review`;
  const unauthenticated = await request(app).get(reviewPath);
  assert.equal(unauthenticated.status, 401);
  const otherStudent = await request(app).get(reviewPath).set({ Authorization: `Bearer ${tokenB}` });
  assert.equal(otherStudent.status, 404);
  assert.equal(otherStudent.body.error.code, 'ATTEMPT_NOT_FOUND');
  const invalidAttempt = await request(app)
    .get(`/api/lessons/${lesson.id}/assessment-attempts/not-an-id/review`)
    .set({ Authorization: `Bearer ${tokenA}` });
  assert.equal(invalidAttempt.status, 400);

  const review = await request(app).get(reviewPath).set({ Authorization: `Bearer ${tokenA}` });
  assert.equal(review.status, 200);
  assert.equal(review.body.data.allCorrect, false);
  assert.equal(review.body.data.lesson.title, lesson.title);
  assert.equal(review.body.data.lesson.subject.name, mil.name);
  assert.equal(review.body.data.incorrectAnswers.length, 1);
  const incorrect = review.body.data.incorrectAnswers[0];
  const sourceQuestion = questions.find(({ _id }) => String(_id) === incorrect.questionId);
  assert.equal(incorrect.question, sourceQuestion.question);
  assert.equal(incorrect.yourAnswer, sourceQuestion.choices[answers[1].selectedAnswer]);
  assert.equal(incorrect.correctAnswer, sourceQuestion.choices[sourceQuestion.correctAnswer]);
  assert.equal(incorrect.explanation, sourceQuestion.explanation);
  await ReadingQuestion.deleteOne({ _id: sourceQuestion._id });
  try {
    const afterDeletion = await request(app).get(reviewPath).set({ Authorization: `Bearer ${tokenA}` });
    assert.equal(afterDeletion.status, 200);
    assert.equal(afterDeletion.body.data.incorrectAnswers[0].question, sourceQuestion.question);
    assert.equal(afterDeletion.body.data.incorrectAnswers[0].correctAnswer, sourceQuestion.choices[sourceQuestion.correctAnswer]);
    assert.equal(afterDeletion.body.data.incorrectAnswers[0].questionAvailable, true);
  } finally {
    await ReadingQuestion.create(sourceQuestion);
  }
  assert.equal(await ActivityRecord.countDocuments({ user: studentA._id, activityType: 'reading_assessment', lesson: lesson._id }), activityCount);
});

test('all-correct attempts return a positive review state and deleted question records are handled safely', async () => {
  const mil = await Subject.findOne({ code: 'MIL' });
  const lesson = await Lesson.findOne({ subject: mil._id, lessonNumber: 2 });
  const questions = await ReadingQuestion.find({ lesson: lesson._id, isPublished: true })
    .select('+correctAnswer')
    .lean();
  const answers = questions.map(({ _id, correctAnswer }) => ({ questionId: String(_id), selectedAnswer: correctAnswer }));
  const submitted = await request(app)
    .post(`/api/lessons/${lesson.id}/assessment`)
    .set({ Authorization: `Bearer ${tokenA}` })
    .send({ answers });
  assert.equal(submitted.status, 201);
  const path = `/api/lessons/${lesson.id}/assessment-attempts/${submitted.body.data.attemptId}/review`;
  const allCorrect = await request(app).get(path).set({ Authorization: `Bearer ${tokenA}` });
  assert.equal(allCorrect.status, 200);
  assert.equal(allCorrect.body.data.allCorrect, true);
  assert.deepEqual(allCorrect.body.data.incorrectAnswers, []);

  const missingQuestionId = new mongoose.Types.ObjectId();
  const orphanAttempt = await AssessmentAttempt.create({
    user: studentA._id,
    lesson: lesson._id,
    answers: [{ questionId: missingQuestionId, selectedAnswer: 0, isCorrect: false, pointsEarned: 0 }],
    score: 0,
    totalItems: 1,
    totalPoints: 1,
    percentage: 0,
  });
  try {
    const orphanReview = await request(app)
      .get(`/api/lessons/${lesson.id}/assessment-attempts/${orphanAttempt.id}/review`)
      .set({ Authorization: `Bearer ${tokenA}` });
    assert.equal(orphanReview.status, 200);
    assert.equal(orphanReview.body.data.incorrectAnswers.length, 1);
    assert.equal(orphanReview.body.data.incorrectAnswers[0].questionAvailable, false);
    assert.equal(orphanReview.body.data.incorrectAnswers[0].yourAnswer, null);
    assert.equal(orphanReview.body.data.incorrectAnswers[0].correctAnswer, null);
  } finally {
    await AssessmentAttempt.deleteOne({ _id: orphanAttempt._id });
  }
});
