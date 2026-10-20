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
const StudentProgress = require('../models/StudentProgress');
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
  jwtSecret: 'test-secret-that-is-long-enough-for-admin-tests',
  jwtExpiresIn: '1h',
  corsOrigins: [],
};

let mongoServer;
let app;
let admin;
let student;
let adminToken;
let studentToken;
let mil;
let milLesson;
let milQuestions;
let milWriting;

function tokenFor(user) {
  return jwt.sign({ sub: String(user._id) }, config.jwtSecret, {
    expiresIn: '1h', issuer: 'readsmart-api', audience: 'readsmart-mobile',
  });
}

function asAdmin(req) { return req.set({ Authorization: `Bearer ${adminToken}` }); }
function asStudent(req) { return req.set({ Authorization: `Bearer ${studentToken}` }); }

const lessonContent = {
  title: 'Admin-managed lesson',
  lessonNumber: 1,
  overview: 'A concise overview of the lesson.',
  lesson: 'This is the main explanatory lesson content for a student reading activity.',
  discussion: 'A supporting discussion section for the lesson.',
  example: 'This is an example related to the lesson topic.',
  keyConcepts: ['Reading concept', 'Learning concept'],
  keyTakeaway: 'The student should remember the main idea.',
  contentStatus: 'ready',
};

const questionContent = {
  question: 'Which statement best explains the central idea in this lesson?',
  questionType: 'key_idea',
  choices: ['The supported central idea', 'An unrelated detail', 'An unsupported claim', 'A different topic'],
  correctAnswer: 0,
  explanation: 'This option directly reflects the lesson content and its central idea.',
  points: 1,
  order: 1,
};

const writingContent = {
  title: 'Explain the lesson idea',
  prompt: 'Explain one important idea from the lesson and support your response with an example.',
  instructions: 'Write a clear response that explains your thinking and includes supporting details.',
  minimumWords: 10,
  maximumWords: 150,
};

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await connectDatabase(mongoServer.getUri('readsmart_admin_test'));
  await applyReadingSeed();
  await applyMilContentImport();
  await applyUcspContentImport();
  await applyCparContentImport();
  await applyElsContentImport();
  await applyAssessmentSeed();
  await applyWritingSeed();
  await Promise.all([User.init(), Subject.init(), Lesson.init(), ReadingQuestion.init(), WritingActivity.init(), ActivityRecord.init(), StudentProgress.init()]);
  app = createApp(config);
  admin = await User.create({ name: 'READSMART Admin', email: 'admin-test@example.com', passwordHash: 'test-hash', role: 'admin' });
  student = await User.create({ name: 'READSMART Student', email: 'student-test@example.com', passwordHash: 'test-hash', role: 'student' });
  adminToken = tokenFor(admin);
  studentToken = tokenFor(student);
  mil = await Subject.findOne({ code: 'MIL' });
  milLesson = await Lesson.findOne({ subject: mil._id, lessonNumber: 1 });
  milQuestions = await ReadingQuestion.find({ lesson: milLesson._id, isPublished: true }).select('+correctAnswer').sort({ order: 1 });
  milWriting = await WritingActivity.findOne({ lesson: milLesson._id, isPublished: true });
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test('admin endpoints require authentication and students receive 403 for every protected area', async () => {
  const anonymous = await request(app).get('/api/admin/dashboard');
  assert.equal(anonymous.status, 401);
  const anonymousUsers = await request(app).get('/api/admin/users');
  assert.equal(anonymousUsers.status, 401);
  const requests = [
    request(app).get('/api/admin/dashboard'),
    request(app).get('/api/admin/users'),
    request(app).post('/api/admin/subjects').send({}),
    request(app).put(`/api/admin/lessons/${milLesson.id}`).send({ title: 'Changed title' }),
    request(app).put(`/api/admin/questions/${milQuestions[0].id}`).send({ question: 'Change this question text.' }),
    request(app).put(`/api/admin/writing/${milWriting.id}`).send({ title: 'Changed activity' }),
  ];
  for (const result of await Promise.all(requests.map((req) => asStudent(req)))) assert.equal(result.status, 403);
});

test('admin dashboard and student endpoints return safe account and calculated progress data', async () => {
  const dashboard = await asAdmin(request(app).get('/api/admin/dashboard'));
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.body.data.totalStudents, 1);
  assert.equal(dashboard.body.data.totalSubjects, 4);
  assert.equal(dashboard.body.data.totalLessons, 40);
  assert.equal(dashboard.body.data.publishedLessons, 40);
  assert.equal(dashboard.body.data.totalReadingQuestions, 200);
  assert.equal(dashboard.body.data.totalWritingActivities, 40);

  const list = await asAdmin(request(app).get('/api/admin/users?page=1&limit=10'));
  assert.equal(list.status, 200);
  assert.equal(list.body.data.users.length, 1);
  const listedStudent = list.body.data.users[0];
  assert.equal(listedStudent.email, student.email);
  assert.equal(listedStudent.level, 1);
  assert.equal(listedStudent.totalXP, 0);
  assert.equal('passwordHash' in listedStudent, false);
  assert.equal('password' in listedStudent, false);
  assert.equal(list.body.data.pagination.total, 1);

  const profile = await asAdmin(request(app).get(`/api/admin/users/${student.id}`));
  assert.equal(profile.status, 200);
  assert.equal(profile.body.data.user.email, student.email);
  assert.equal('passwordHash' in profile.body.data.user, false);

  const progress = await asAdmin(request(app).get(`/api/admin/users/${student.id}/progress`));
  assert.equal(progress.status, 200);
  assert.equal(progress.body.data.progress.level, 1);
  assert.equal(progress.body.data.progress.totalXP, 0);
  assert.equal(progress.body.data.subjects.length, 4);
  assert.ok(progress.body.data.subjects.every((subject) => (
    subject.completedReadingAssessments === 0
    && subject.completedWritingActivities === 0
    && subject.totalXP === 0
  )));
  assert.ok(await StudentProgress.exists({ user: student._id }));

  const invalidPagination = await asAdmin(request(app).get('/api/admin/users?limit=200'));
  assert.equal(invalidPagination.status, 400);
});

test('parallel first-time progress reads safely initialize one progress record', async () => {
  const fresh = await User.create({ name: 'Fresh Student', email: 'fresh-progress@example.com', passwordHash: 'test-hash', role: 'student' });
  const freshToken = tokenFor(fresh);
  const [overall, subjects] = await Promise.all([
    request(app).get('/api/progress/me').set({ Authorization: `Bearer ${freshToken}` }),
    request(app).get('/api/progress/subjects').set({ Authorization: `Bearer ${freshToken}` }),
  ]);
  assert.equal(overall.status, 200);
  assert.equal(subjects.status, 200);
  assert.equal(await StudentProgress.countDocuments({ user: fresh._id }), 1);
});

test('admin creates and updates subjects and rejects invalid or duplicate subjects', async () => {
  const invalid = await asAdmin(request(app).post('/api/admin/subjects').send({ name: 'X', code: 'X', order: -1 }));
  assert.equal(invalid.status, 400);

  const duplicate = await asAdmin(request(app).post('/api/admin/subjects').send({ name: 'Media and Information Literacy', code: 'NEWCODE', order: 9 }));
  assert.equal(duplicate.status, 409);

  const created = await asAdmin(request(app).post('/api/admin/subjects').send({ name: 'Test Subject', code: 'TEST', description: 'Test description', order: 50 }));
  assert.equal(created.status, 201);
  const subjectId = created.body.data.subject.id;
  const unpublished = await asAdmin(request(app).patch(`/api/admin/subjects/${subjectId}/publish`).send({ isActive: false }));
  assert.equal(unpublished.status, 200);
  const updated = await asAdmin(request(app).put(`/api/admin/subjects/${subjectId}`).send({ description: 'Updated description' }));
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.subject.description, 'Updated description');
  assert.equal(unpublished.body.data.subject.isActive, false);
  assert.equal(updated.body.data.subject.isActive, false, 'Editing the description does not republish the subject.');
  const visible = await asStudent(request(app).get('/api/subjects'));
  assert.equal(visible.body.data.subjects.some(({ id }) => id === subjectId), false);
});

test('admin creates, edits, and publishes lessons, questions, and writing activities without deleting student records', async () => {
  const createSubject = await asAdmin(request(app).post('/api/admin/subjects').send({ name: 'Content Management Subject', code: 'CMS', description: '', order: 51 }));
  assert.equal(createSubject.status, 201);
  const managedSubjectId = createSubject.body.data.subject.id;
  const badLesson = await asAdmin(request(app).post(`/api/admin/subjects/${managedSubjectId}/lessons`).send({ title: 'Missing body', lessonNumber: 55 }));
  assert.equal(badLesson.status, 400);

  const createdLesson = await asAdmin(request(app).post(`/api/admin/subjects/${managedSubjectId}/lessons`).send(lessonContent));
  assert.equal(createdLesson.status, 201);
  const lessonId = createdLesson.body.data.lesson.id;
  assert.equal(createdLesson.body.data.lesson.isPublished, false);
  const duplicateLesson = await asAdmin(request(app).post(`/api/admin/subjects/${managedSubjectId}/lessons`).send(lessonContent));
  assert.equal(duplicateLesson.status, 409);

  const publishedLesson = await asAdmin(request(app).patch(`/api/admin/lessons/${lessonId}/publish`).send({ isPublished: true }));
  assert.equal(publishedLesson.status, 200);
  assert.equal(publishedLesson.body.data.lesson.isPublished, true);
  const updatedLesson = await asAdmin(request(app).put(`/api/admin/lessons/${lessonId}`).send({ title: 'Updated admin lesson' }));
  assert.equal(updatedLesson.status, 200);
  assert.equal(updatedLesson.body.data.lesson.title, 'Updated admin lesson');
  assert.equal(updatedLesson.body.data.lesson.isPublished, true, 'Editing a published lesson does not unpublish it.');
  const studentLessons = await asStudent(request(app).get(`/api/subjects/${managedSubjectId}/lessons`));
  assert.ok(studentLessons.body.data.lessons.some(({ id }) => id === lessonId));

  const invalidType = await asAdmin(request(app).post(`/api/admin/lessons/${lessonId}/questions`).send({ ...questionContent, questionType: 'trivia' }));
  assert.equal(invalidType.status, 400);
  const invalidAnswer = await asAdmin(request(app).post(`/api/admin/lessons/${lessonId}/questions`).send({ ...questionContent, correctAnswer: 4 }));
  assert.equal(invalidAnswer.status, 400);

  const createdQuestion = await asAdmin(request(app).post(`/api/admin/lessons/${lessonId}/questions`).send(questionContent));
  assert.equal(createdQuestion.status, 201);
  const questionId = createdQuestion.body.data.question.id;
  const publishedQuestion = await asAdmin(request(app).patch(`/api/admin/questions/${questionId}/publish`).send({ isPublished: true }));
  assert.equal(publishedQuestion.status, 200);
  const updatedQuestion = await asAdmin(request(app).put(`/api/admin/questions/${questionId}`).send({ explanation: 'An updated explanation tied to the lesson content.' }));
  assert.equal(updatedQuestion.status, 200);
  assert.equal(updatedQuestion.body.data.question.isPublished, true, 'Editing a published question does not unpublish it.');
  const studentQuestion = await asStudent(request(app).get(`/api/lessons/${lessonId}/questions`));
  assert.equal(studentQuestion.status, 200);
  assert.equal(studentQuestion.body.data.questions.length, 1);
  assert.equal('correctAnswer' in studentQuestion.body.data.questions[0], false);

  const badWriting = await asAdmin(request(app).post(`/api/admin/lessons/${lessonId}/writing`).send({ ...writingContent, minimumWords: 100, maximumWords: 10 }));
  assert.equal(badWriting.status, 400);
  const createdWriting = await asAdmin(request(app).post(`/api/admin/lessons/${lessonId}/writing`).send(writingContent));
  assert.equal(createdWriting.status, 201);
  const writingId = createdWriting.body.data.activity.id;
  const duplicateWriting = await asAdmin(request(app).post(`/api/admin/lessons/${lessonId}/writing`).send(writingContent));
  assert.equal(duplicateWriting.status, 409);
  const publishedWriting = await asAdmin(request(app).patch(`/api/admin/writing/${writingId}/publish`).send({ isPublished: true }));
  assert.equal(publishedWriting.status, 200);
  const updatedWriting = await asAdmin(request(app).put(`/api/admin/writing/${writingId}`).send({ title: 'Updated writing prompt' }));
  assert.equal(updatedWriting.status, 200);
  assert.equal(updatedWriting.body.data.activity.isPublished, true, 'Editing a published writing activity does not unpublish it.');
  const studentWriting = await asStudent(request(app).get(`/api/lessons/${lessonId}/writing`));
  assert.equal(studentWriting.status, 200);
  assert.equal(studentWriting.body.data.activity.title, 'Updated writing prompt');

  const answer = await asStudent(request(app).post(`/api/lessons/${lessonId}/assessment`).send({
    answers: [{ questionId, selectedAnswer: 0 }],
  }));
  assert.equal(answer.status, 201);
  const response = Array.from({ length: 16 }, (_item, index) => `This lesson idea has a useful example ${index}.`).join(' ');
  const writing = await asStudent(request(app).post(`/api/lessons/${lessonId}/writing`).send({ writingActivityId: writingId, response }));
  assert.equal(writing.status, 201);
  const progressFetch = await asStudent(request(app).get('/api/progress/me'));
  assert.equal(progressFetch.status, 200);
  assert.equal(progressFetch.body.data.totalXP, 45);

  const attemptCount = await AssessmentAttempt.countDocuments({ user: student._id, lesson: lessonId });
  const submissionCount = await WritingSubmission.countDocuments({ user: student._id, lesson: lessonId });
  const activityCount = await ActivityRecord.countDocuments({ user: student._id, lesson: lessonId });
  const progressBefore = await StudentProgress.findOne({ user: student._id }).lean();

  const unpublishedQuestion = await asAdmin(request(app).patch(`/api/admin/questions/${questionId}/publish`).send({ isPublished: false }));
  assert.equal(unpublishedQuestion.status, 200);
  const unpublishedWriting = await asAdmin(request(app).patch(`/api/admin/writing/${writingId}/publish`).send({ isPublished: false }));
  assert.equal(unpublishedWriting.status, 200);
  const unpublishedLesson = await asAdmin(request(app).patch(`/api/admin/lessons/${lessonId}/publish`).send({ isPublished: false }));
  assert.equal(unpublishedLesson.status, 200);

  assert.equal(await AssessmentAttempt.countDocuments({ user: student._id, lesson: lessonId }), attemptCount);
  assert.equal(await WritingSubmission.countDocuments({ user: student._id, lesson: lessonId }), submissionCount);
  assert.equal(await ActivityRecord.countDocuments({ user: student._id, lesson: lessonId }), activityCount);
  assert.ok(await StudentProgress.exists({ _id: progressBefore._id }));
  assert.equal((await asStudent(request(app).get(`/api/lessons/${lessonId}`))).status, 404);
});

test('unpublishing existing content retains its assessment attempts and writing submissions', async () => {
  const answers = milQuestions.map((question) => ({ questionId: String(question._id), selectedAnswer: question.correctAnswer }));
  const attempt = await asStudent(request(app).post(`/api/lessons/${milLesson.id}/assessment`).send({ answers }));
  assert.equal(attempt.status, 201);
  const response = Array.from({ length: 25 }, (_item, index) => `Students can explain important lesson ideas with examples ${index}.`).join(' ');
  const submission = await asStudent(request(app).post(`/api/lessons/${milLesson.id}/writing`).send({ writingActivityId: String(milWriting._id), response }));
  assert.equal(submission.status, 201);
  const progress = await asStudent(request(app).get('/api/progress/me'));
  assert.equal(progress.status, 200);
  assert.ok(await StudentProgress.exists({ user: student._id }));

  const attemptsBefore = await AssessmentAttempt.countDocuments({ user: student._id, lesson: milLesson._id });
  const submissionsBefore = await WritingSubmission.countDocuments({ user: student._id, lesson: milLesson._id });
  const unpublish = await asAdmin(request(app).patch(`/api/admin/lessons/${milLesson.id}/publish`).send({ isPublished: false }));
  assert.equal(unpublish.status, 200);
  assert.equal(await AssessmentAttempt.countDocuments({ user: student._id, lesson: milLesson._id }), attemptsBefore);
  assert.equal(await WritingSubmission.countDocuments({ user: student._id, lesson: milLesson._id }), submissionsBefore);
  assert.ok(await StudentProgress.exists({ user: student._id }));
});

test('admins can view a student writing history while students cannot use admin history routes', async () => {
  const ucsp = await Subject.findOne({ code: 'UCSP' });
  const lesson = await Lesson.findOne({ subject: ucsp._id, lessonNumber: 1 });
  const activity = await WritingActivity.findOne({ lesson: lesson._id, isPublished: true });
  const responseText = Array.from({ length: activity.minimumWords }, (_item, index) => `Reflection ${index}`).join(' ') + '.';
  const submitted = await asStudent(request(app)
    .post(`/api/lessons/${lesson.id}/writing`)
    .send({ writingActivityId: String(activity._id), response: responseText }));
  assert.equal(submitted.status, 201);

  const historyPath = `/api/admin/users/${student.id}/writing-submissions`;
  assert.equal((await request(app).get(historyPath)).status, 401);
  assert.equal((await asStudent(request(app).get(historyPath))).status, 403);

  const history = await asAdmin(request(app).get(historyPath));
  assert.equal(history.status, 200);
  const entry = history.body.data.submissions.find(({ id }) => id === submitted.body.data.submissionId);
  assert.ok(entry);
  assert.equal(entry.writingActivity.title, activity.title);
  assert.equal(entry.lesson.subject.code, 'UCSP');
  assert.equal(entry.responsePreview.startsWith('Reflection 0'), true);
  assert.equal(entry.score.totalScore, submitted.body.data.totalScore);

  const detailPath = `${historyPath}/${submitted.body.data.submissionId}`;
  const detail = await asAdmin(request(app).get(detailPath));
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.submission.response, responseText);
  assert.equal(detail.body.data.submission.feedback, submitted.body.data.feedback);

  const unrelatedStudent = await User.create({
    name: 'No Submissions Student',
    email: 'no-writing-submissions@example.com',
    passwordHash: 'test-hash',
    role: 'student',
  });
  const unrelatedHistory = await asAdmin(request(app).get(`/api/admin/users/${unrelatedStudent.id}/writing-submissions`));
  assert.equal(unrelatedHistory.status, 200);
  assert.equal(unrelatedHistory.body.data.submissions.length, 0);
  const adminAsStudent = await asAdmin(request(app).get(`/api/admin/users/${admin.id}/writing-submissions`));
  assert.equal(adminAsStudent.status, 404);
});
