const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const AssessmentAttempt = require('../models/AssessmentAttempt');
const Lesson = require('../models/Lesson');
const ReadingQuestion = require('../models/ReadingQuestion');
const Subject = require('../models/Subject');
const { getConfig } = require('../config/env');
const { connectDatabase } = require('../config/database');
const { assessmentCatalog, questionTypes } = require('./assessmentCatalog');

const subjectCodes = ['MIL', 'UCSP', 'CPAR', 'ELS'];

function validateAssessmentCatalog() {
  assert.equal(questionTypes.length, 5);
  assert.equal(assessmentCatalog.length, 200, 'Assessment catalog must contain 200 questions.');
  const questionKeys = new Set();
  const counts = Object.fromEntries(subjectCodes.map((code) => [code, 0]));
  const lessonCounts = new Map();
  for (const question of assessmentCatalog) {
    assert.ok(counts[question.subjectCode] !== undefined, `Unknown subject code ${question.subjectCode}.`);
    counts[question.subjectCode] += 1;
    const lessonKey = `${question.subjectCode}:${question.lessonNumber}`;
    lessonCounts.set(lessonKey, (lessonCounts.get(lessonKey) || 0) + 1);
    questionKeys.add(`${lessonKey}:${question.order}`);
    assert.equal(question.choices.length, 4, `${lessonKey} question ${question.order} must have four choices.`);
    assert.equal(new Set(question.choices).size, 4, `${lessonKey} question ${question.order} choices must be unique.`);
    assert.ok(Number.isInteger(question.correctAnswer) && question.correctAnswer >= 0 && question.correctAnswer < 4);
    assert.ok(question.question.trim().length >= 10);
    assert.ok(question.explanation.trim().length >= 10);
    assert.ok(questionTypes.includes(question.questionType));
    assert.ok(question.correctAnswer >= 0 && question.correctAnswer < question.choices.length);
    assert.equal(question.points, 1);
    assert.equal(question.isPublished, true);
  }
  assert.equal(questionKeys.size, 200, 'Assessment catalog must have unique lesson/order keys.');
  for (const code of subjectCodes) assert.equal(counts[code], 50, `${code} must have 50 questions.`);
  for (const code of subjectCodes) {
    for (let lessonNumber = 1; lessonNumber <= 10; lessonNumber += 1) {
      const key = `${code}:${lessonNumber}`;
      assert.equal(lessonCounts.get(key), 5, `${key} must have five questions.`);
      const types = assessmentCatalog
        .filter((question) => question.subjectCode === code && question.lessonNumber === lessonNumber)
        .map(({ questionType }) => questionType);
      assert.deepEqual(types, questionTypes, `${key} must have one question of each type in order.`);
    }
  }
}

async function applyAssessmentSeed() {
  validateAssessmentCatalog();
  await Subject.init();
  await Lesson.init();
  await ReadingQuestion.init();
  await AssessmentAttempt.init();

  const subjects = await Subject.find({ code: { $in: subjectCodes } }).lean();
  assert.equal(subjects.length, 4, 'Seed reading content for all four subjects before assessment questions.');
  const subjectIds = new Map(subjects.map(({ code, _id }) => [code, _id]));
  const lessonIds = new Map();
  const lessonKeysById = new Map();
  for (const code of subjectCodes) {
    const publishedLessons = await Lesson.find({
      subject: subjectIds.get(code),
      isPublished: true,
      contentStatus: 'ready',
    }).select('_id lessonNumber').lean();
    assert.equal(publishedLessons.length, 10, `${code} must have ten published lessons before seeding assessments.`);
    assert.deepEqual(publishedLessons.map(({ lessonNumber }) => lessonNumber).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const lesson of publishedLessons) {
      const lessonKey = `${code}:${lesson.lessonNumber}`;
      lessonIds.set(lessonKey, lesson._id);
      lessonKeysById.set(String(lesson._id), lessonKey);
    }
  }

  const existingQuestions = await ReadingQuestion.find().select('_id lesson order').lean();
  const existingIds = new Map(existingQuestions.map(({ lesson, order, _id }) => [`${lesson}:${order}`, String(_id)]));
  for (const question of assessmentCatalog) {
    const lessonId = lessonIds.get(`${question.subjectCode}:${question.lessonNumber}`);
    assert.ok(lessonId, `Published lesson ${question.subjectCode}:${question.lessonNumber} was not found.`);
    await ReadingQuestion.updateOne(
      { lesson: lessonId, order: question.order },
      {
        $set: {
          question: question.question,
          questionType: question.questionType,
          choices: question.choices,
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
          points: question.points,
          isPublished: question.isPublished,
        },
        $setOnInsert: { lesson: lessonId, order: question.order },
      },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
  }

  const allQuestions = await ReadingQuestion.find().select('+correctAnswer').lean();
  assert.equal(allQuestions.length, 200, 'The assessment database must contain exactly 200 questions.');
  const counts = Object.fromEntries(subjectCodes.map((code) => [code, 0]));
  const catalogByRecordKey = new Map(assessmentCatalog.map((question) => [
    `${lessonIds.get(`${question.subjectCode}:${question.lessonNumber}`)}:${question.order}`,
    question,
  ]));
  for (const question of allQuestions) {
    const lessonKey = lessonKeysById.get(String(question.lesson));
    assert.ok(lessonKey, 'Every assessment question must reference one of the 40 catalog lessons.');
    const expected = catalogByRecordKey.get(`${question.lesson}:${question.order}`);
    assert.ok(expected, 'Every assessment question must match a catalog question and lesson order.');
    for (const field of ['question', 'questionType', 'correctAnswer', 'explanation', 'points', 'order', 'isPublished']) {
      assert.equal(question[field], expected[field], `Stored ${field} must match ${lessonKey} question ${question.order}.`);
    }
    assert.deepEqual(question.choices, expected.choices);
    const code = lessonKey.split(':')[0];
    counts[code] += 1;
    assert.equal(question.isPublished, true, 'All seeded assessment questions must be published.');
    assert.equal(question.choices[question.correctAnswer] !== undefined, true);
    const priorId = existingIds.get(`${question.lesson}:${question.order}`);
    if (priorId) assert.equal(String(question._id), priorId, 'Existing question IDs should remain stable.');
  }
  for (const code of subjectCodes) assert.equal(counts[code], 50, `${code} must have exactly 50 questions.`);

  const duplicateGroups = await ReadingQuestion.aggregate([
    { $group: { _id: { lesson: '$lesson', order: '$order' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);
  assert.equal(duplicateGroups.length, 0, 'Duplicate lesson/order questions must not exist.');

  return { subjectCount: subjects.length, lessonCount: lessonIds.size, questionCount: allQuestions.length, counts };
}

async function main() {
  try {
    await connectDatabase(getConfig().mongoUri);
    const result = await applyAssessmentSeed();
    console.log(`Assessment data seeded: ${result.questionCount} questions across ${result.lessonCount} published lessons and ${result.subjectCount} subjects.`);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Assessment data seed failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { applyAssessmentSeed, validateAssessmentCatalog };
