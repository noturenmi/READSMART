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

const config = {
  jwtSecret: 'test-secret-that-is-long-enough-for-learning-report-tests',
  jwtExpiresIn: '1h',
  corsOrigins: [],
};

let mongoServer;
let app;
let student;
let otherStudent;
let writingOnlyStudent;
let admin;
let studentToken;
let otherToken;
let adminToken;
let subjectsByCode;
let lessonsByCode;
let activitiesByCode;

function createToken(user) {
  return jwt.sign({ sub: user.id }, config.jwtSecret, {
    expiresIn: '1h',
    issuer: 'readsmart-api',
    audience: 'readsmart-mobile',
  });
}

async function makeAttempt(user, lesson, questionList, score, submittedAt, { snapshotLabel = '' } = {}) {
  const totalPoints = questionList.reduce((sum, question) => sum + question.points, 0);
  let pointsRemaining = score;
  const answers = questionList.map((question) => {
    const correct = Math.min(question.points, pointsRemaining);
    pointsRemaining -= correct;
    const isCorrect = correct === question.points;
    return {
      questionId: question._id,
      selectedAnswer: isCorrect ? question.correctAnswer : (question.correctAnswer + 1) % 4,
      isCorrect,
      pointsEarned: correct,
      questionText: `${question.question}${snapshotLabel}`,
      choices: question.choices,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      questionType: question.questionType,
      order: question.order,
    };
  });
  return AssessmentAttempt.create({
    user: user._id,
    lesson: lesson._id,
    answers,
    score,
    totalItems: questionList.length,
    totalPoints,
    percentage: Math.round((score / totalPoints) * 100),
    submittedAt,
  });
}

async function makeWritingSubmission(user, lesson, activity, score, submittedAt) {
  let remaining = score - 5;
  const values = RUBRIC_KEYS.map(() => {
    const extra = Math.min(4, remaining);
    remaining -= extra;
    return 1 + extra;
  });
  const rubricScores = Object.fromEntries(RUBRIC_KEYS.map((key, index) => [key, values[index]]));
  const totalScore = Object.values(rubricScores).reduce((sum, value) => sum + value, 0);
  return WritingSubmission.create({
    user: user._id,
    lesson: lesson._id,
    writingActivity: activity._id,
    response: 'A saved writing response with an explanation of the lesson ideas and examples for review.',
    wordCount: 15,
    rubricScores,
    criterionFeedback: {
      grammar: 'Grammar feedback.',
      vocabulary: 'Vocabulary feedback.',
      organization: 'Organization feedback.',
      coherence: 'Coherence feedback.',
      developmentOfIdeas: 'Development feedback.',
    },
    totalScore,
    maxScore: 25,
    percentage: Math.round((totalScore / 25) * 100),
    feedback: 'Saved official rubric feedback.',
    submittedAt,
  });
}

const RUBRIC_KEYS = ['grammar', 'vocabulary', 'organization', 'coherence', 'developmentOfIdeas'];

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await connectDatabase(mongoServer.getUri('readsmart_learning_report_test'));
  await applyReadingSeed();
  await applyMilContentImport();
  await applyUcspContentImport();
  await applyCparContentImport();
  await applyElsContentImport();
  await applyAssessmentSeed();
  await applyWritingSeed();
  app = createApp(config);

  [student, otherStudent, writingOnlyStudent, admin] = await Promise.all([
    User.create({ name: 'Report Student', email: 'report-student@example.com', passwordHash: 'test-hash', role: 'student' }),
    User.create({ name: 'Other Report Student', email: 'report-other@example.com', passwordHash: 'test-hash', role: 'student' }),
    User.create({ name: 'Writing Only Student', email: 'report-writing-only@example.com', passwordHash: 'test-hash', role: 'student' }),
    User.create({ name: 'Report Admin', email: 'report-admin@example.com', passwordHash: 'test-hash', role: 'admin' }),
  ]);
  studentToken = createToken(student);
  otherToken = createToken(otherStudent);
  adminToken = createToken(admin);

  const subjects = await Subject.find({ isActive: true }).lean();
  subjectsByCode = new Map(subjects.map((subject) => [subject.code, subject]));
  lessonsByCode = new Map();
  activitiesByCode = new Map();
  for (const [code, subject] of subjectsByCode) {
    const lessons = await Lesson.find({ subject: subject._id, isPublished: true, contentStatus: 'ready' }).sort({ lessonNumber: 1 }).lean();
    lessonsByCode.set(code, lessons);
    const activities = await WritingActivity.find({ lesson: { $in: lessons.map(({ _id }) => _id) }, isPublished: true }).lean();
    activitiesByCode.set(code, new Map(activities.map((activity) => [String(activity.lesson), activity])));
  }
  await WritingActivity.collection.updateMany({}, { $set: { updatedAt: new Date('2026-01-01T00:00:00.000Z') } });
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test('learning report is private, requires authentication, and handles a student with no activity', async () => {
  assert.equal((await request(app).get('/api/progress/report')).status, 401);
  const response = await request(app).get('/api/progress/report').set({ Authorization: `Bearer ${studentToken}` });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.summary.readingAssessmentCount, 0);
  assert.equal(response.body.data.summary.writingSubmissionCount, 0);
  assert.equal(response.body.data.summary.overallProgressPercentage, 0);
  assert.deepEqual(response.body.data.reading.trends, []);
  assert.deepEqual(response.body.data.writing.trends, []);
  assert.equal(response.body.data.reading.results.length, 0);
  assert.equal(response.body.data.writing.submissions.length, 0);
  assert.equal(response.body.data.progress.totalXP, 0);
  assert.match(response.body.data.comparisonNote, /not proof of learning improvement/);
  assert.equal(Object.hasOwn(response.body.data, 'student'), false);
});

test('reading report shows single results and compares only matching lesson question snapshots', async () => {
  const mil = lessonsByCode.get('MIL');
  const ucsp = lessonsByCode.get('UCSP');
  const cpar = lessonsByCode.get('CPAR');
  const els = lessonsByCode.get('ELS');
  const milQuestions = await ReadingQuestion.find({ lesson: mil[0]._id, isPublished: true }).select('+correctAnswer').sort({ order: 1 }).lean();
  const milSecondQuestions = await ReadingQuestion.find({ lesson: mil[1]._id, isPublished: true }).select('+correctAnswer').sort({ order: 1 }).lean();
  const ucspQuestions = await ReadingQuestion.find({ lesson: ucsp[0]._id, isPublished: true }).select('+correctAnswer').sort({ order: 1 }).lean();
  const cparQuestions = await ReadingQuestion.find({ lesson: cpar[0]._id, isPublished: true }).select('+correctAnswer').sort({ order: 1 }).lean();
  const elsQuestions = await ReadingQuestion.find({ lesson: els[0]._id, isPublished: true }).select('+correctAnswer').sort({ order: 1 }).lean();
  const date = (day) => new Date(`2026-02-${String(day).padStart(2, '0')}T12:00:00.000Z`);

  await makeAttempt(student, mil[0], milQuestions, 1, date(1));
  await makeAttempt(student, mil[0], milQuestions, 3, date(2));
  await makeAttempt(student, mil[0], milQuestions, 4, date(3));
  await makeAttempt(student, mil[0], milQuestions, 4, date(4), { snapshotLabel: ' (revised question set)' });
  await makeAttempt(student, mil[1], milSecondQuestions, 5, date(5));
  await makeAttempt(student, ucsp[0], ucspQuestions, 4, date(6));
  await makeAttempt(student, ucsp[0], ucspQuestions, 2, date(7));
  await makeAttempt(student, cpar[0], cparQuestions, 3, date(8));
  await makeAttempt(student, cpar[0], cparQuestions, 3, date(9));
  await makeAttempt(student, els[0], elsQuestions, 2, date(10));

  const response = await request(app).get('/api/progress/report').set({ Authorization: `Bearer ${studentToken}` });
  assert.equal(response.status, 200);
  const trends = response.body.data.reading.trends;
  const findTrend = (code, lesson, attemptCount) => trends.find((trend) => (
    trend.lesson?.subject?.code === code
      && trend.lesson.id === String(lesson._id)
      && trend.attemptCount === attemptCount
  ));
  const increased = findTrend('MIL', mil[0], 3);
  assert.ok(increased);
  assert.equal(increased.change.status, 'increased');
  assert.equal(increased.change.scoreDelta, 1);
  const revisedSet = findTrend('MIL', mil[0], 1);
  assert.ok(revisedSet);
  assert.equal(revisedSet.change, null);
  const decreased = findTrend('UCSP', ucsp[0], 2);
  assert.equal(decreased.change.status, 'decreased');
  assert.equal(decreased.change.scoreDelta, -2);
  const tied = findTrend('CPAR', cpar[0], 2);
  assert.equal(tied.change.status, 'unchanged');
  const single = findTrend('ELS', els[0], 1);
  assert.equal(single.change, null);
  assert.equal(findTrend('MIL', mil[1], 1).change, null);
  assert.ok(response.body.data.subjects.some((subject) => subject.subjectCode === 'MIL'));
  assert.equal(response.body.data.summary.readingAssessmentCount, 10);
  assert.equal(response.body.data.summary.latestReading.lesson.id, String(els[0]._id));
  assert.equal(JSON.stringify(response.body.data).includes('correctAnswer'), false);
});

test('writing report keeps history, rubric scale, feedback, and handles incomplete or undated records', async () => {
  const milLesson = lessonsByCode.get('MIL')[0];
  const ucspLesson = lessonsByCode.get('UCSP')[0];
  const milActivity = activitiesByCode.get('MIL').get(String(milLesson._id));
  const ucspActivity = activitiesByCode.get('UCSP').get(String(ucspLesson._id));
  await makeWritingSubmission(student, milLesson, milActivity, 15, new Date('2026-03-01T10:00:00.000Z'));
  await makeWritingSubmission(student, milLesson, milActivity, 20, new Date('2026-03-02T10:00:00.000Z'));
  await makeWritingSubmission(student, ucspLesson, ucspActivity, 25, new Date('2026-03-03T10:00:00.000Z'));

  await WritingSubmission.collection.insertOne({
    user: student._id,
    lesson: milLesson._id,
    writingActivity: milActivity._id,
    response: 'An incomplete legacy submission.',
    createdAt: new Date('2026-03-04T10:00:00.000Z'),
  });
  await WritingSubmission.collection.insertOne({
    user: student._id,
    lesson: milLesson._id,
    writingActivity: milActivity._id,
    response: 'A record without a reliable timestamp or saved score.',
  });
  await AssessmentAttempt.collection.insertOne({
    user: student._id,
    lesson: milLesson._id,
    answers: [],
    score: 2,
    totalItems: 5,
    totalPoints: 5,
    percentage: 40,
    submittedAt: new Date('2026-03-05T10:00:00.000Z'),
  });

  const response = await request(app).get('/api/progress/report').set({ Authorization: `Bearer ${studentToken}` });
  assert.equal(response.status, 200);
  const data = response.body.data;
  const milTrend = data.writing.trends.find(({ writingActivity }) => writingActivity.id === String(milActivity._id));
  assert.equal(milTrend.change.status, 'increased');
  assert.equal(milTrend.change.scoreDelta, 5);
  assert.equal(milTrend.scale.maxScore, 25);
  assert.equal(data.summary.writingSubmissionCount, 5);
  assert.equal(data.writing.submissions.length, 5);
  assert.ok(data.writing.submissions.some((submission) => submission.resultAvailable === false));
  assert.ok(data.writing.submissions.some((submission) => submission.score?.feedback === 'Saved official rubric feedback.'));
  assert.equal(data.reading.excludedFromComparisonCount, 1);
  assert.equal(data.summary.readingAssessmentCount, 11);
  assert.equal(data.writing.trends.length, 2);
  assert.equal(data.writing.submissions[0].responsePreview.length <= 220, true);
});

test('writing-only history, nonstandard reading scales, and orphan or undated attempts stay safe and incomparable', async () => {
  const lesson = lessonsByCode.get('MIL')[0];
  const activity = activitiesByCode.get('MIL').get(String(lesson._id));
  await makeWritingSubmission(writingOnlyStudent, lesson, activity, 18, new Date('2026-03-06T10:00:00.000Z'));
  const questions = await ReadingQuestion.find({ lesson: lesson._id, isPublished: true })
    .select('+correctAnswer')
    .sort({ order: 1 })
    .lean();
  const scaledAnswers = questions.map((question, index) => ({
    questionId: question._id,
    selectedAnswer: question.correctAnswer,
    isCorrect: index < 4,
    pointsEarned: index < 4 ? 2 : 0,
    questionText: question.question,
    choices: question.choices,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    questionType: question.questionType,
    order: question.order,
  }));
  await AssessmentAttempt.collection.insertOne({
    user: writingOnlyStudent._id,
    lesson: lesson._id,
    answers: scaledAnswers,
    score: 8,
    totalItems: 5,
    totalPoints: 10,
    percentage: 80,
    submittedAt: new Date('2026-03-07T10:00:00.000Z'),
  });
  await AssessmentAttempt.collection.insertOne({
    user: writingOnlyStudent._id,
    lesson: lesson._id,
    answers: [],
    score: 0,
    totalItems: 5,
    totalPoints: 5,
    percentage: 0,
  });
  await AssessmentAttempt.collection.insertOne({
    user: writingOnlyStudent._id,
    lesson: new mongoose.Types.ObjectId(),
    answers: scaledAnswers,
    score: 8,
    totalItems: 5,
    totalPoints: 10,
    percentage: 80,
    submittedAt: new Date('2026-03-08T10:00:00.000Z'),
  });

  const response = await request(app).get('/api/progress/report').set({ Authorization: `Bearer ${createToken(writingOnlyStudent)}` });
  assert.equal(response.status, 200);
  const data = response.body.data;
  assert.equal(data.summary.writingSubmissionCount, 1);
  assert.equal(data.summary.readingAssessmentCount, 3);
  assert.equal(data.reading.trends.length, 0);
  assert.equal(data.reading.excludedFromComparisonCount, 3);
  assert.ok(data.reading.results.some((result) => result.submittedAt === null));
  assert.equal(data.reading.results.some((result) => result.lesson === null), true);
  assert.equal(data.reading.results.some((result) => result.comparisonAvailable), false);
  assert.equal(data.writing.trends.length, 1);
  assert.equal(data.writing.trends[0].change, null);
  assert.equal(data.summary.latestReading.score.totalPoints, 10);
});

test('report results are student-owned and admin report access follows existing role protection', async () => {
  const other = await request(app).get('/api/progress/report').set({ Authorization: `Bearer ${otherToken}` });
  assert.equal(other.status, 200);
  assert.equal(other.body.data.summary.readingAssessmentCount, 0);
  assert.equal(other.body.data.summary.writingSubmissionCount, 0);

  assert.equal((await request(app).get(`/api/admin/users/${student._id}/progress`)).status, 401);
  const forbidden = await request(app).get(`/api/admin/users/${student._id}/progress`).set({ Authorization: `Bearer ${studentToken}` });
  assert.equal(forbidden.status, 403);
  assert.equal((await request(app).get('/api/progress/report').set({ Authorization: `Bearer ${adminToken}` })).status, 403);

  const authorized = await request(app).get(`/api/admin/users/${student._id}/progress`).set({ Authorization: `Bearer ${adminToken}` });
  assert.equal(authorized.status, 200);
  assert.equal(authorized.body.data.learningReport.summary.readingAssessmentCount, 11);
  assert.equal((await request(app).get('/api/admin/users/not-an-id/progress').set({ Authorization: `Bearer ${adminToken}` })).status, 400);
});
