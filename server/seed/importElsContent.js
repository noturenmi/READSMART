const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { isDeepStrictEqual } = require('node:util');
const { getConfig } = require('../config/env');
const { connectDatabase } = require('../config/database');
const Lesson = require('../models/Lesson');
const Subject = require('../models/Subject');
const { subjects: catalogSubjects } = require('./readingCatalog');
const elsLessons = require('./earthLifeScienceLessons.json');

const catalogCodes = ['MIL', 'UCSP', 'CPAR', 'ELS'];

function validateSourceContent() {
  const titles = catalogSubjects.find(({ code }) => code === 'ELS')?.lessons || [];
  assert.equal(elsLessons.length, 10, 'ELS import source must contain exactly 10 lesson bodies.');
  assert.equal(new Set(elsLessons.map(({ lessonNumber }) => lessonNumber)).size, 10, 'ELS lesson numbers must not be duplicated.');
  elsLessons.forEach((lesson, index) => {
    assert.equal(lesson.lessonNumber, index + 1, 'ELS lesson numbers must be sequential from 1 to 10.');
    assert.equal(lesson.title, titles[index], 'ELS titles must match the existing subject catalog.');
    for (const field of ['lesson', 'example', 'keyTakeaway']) {
      assert.equal(typeof lesson[field], 'string');
      assert.ok(lesson[field].trim(), `ELS lesson ${index + 1} is missing ${field}.`);
    }
    assert.equal(typeof lesson.discussion, 'string', `ELS lesson ${index + 1} discussion must be a string.`);
    assert.ok(lesson.discussion.trim(), `ELS lesson ${index + 1} is missing discussion content.`);
    assert.equal(typeof lesson.overview, 'string');
    assert.ok(lesson.overview.length <= 1000, `ELS lesson ${index + 1} overview must fit the existing schema.`);
    assert.ok(Array.isArray(lesson.keyConcepts) && lesson.keyConcepts.length > 0,
      `ELS lesson ${index + 1} is missing key concepts.`);
    assert.ok(lesson.keyConcepts.every((concept) => typeof concept === 'string' && concept.trim()),
      `ELS lesson ${index + 1} contains an invalid key concept.`);
  });
}

async function applyElsContentImport() {
  validateSourceContent();
  await Subject.init();
  await Lesson.init();

  const subject = await Subject.findOne({ code: 'ELS' });
  if (!subject) throw new Error('The existing ELS subject was not found. Run the reading catalog seed first.');
  if (subject.name !== 'Earth and Life Science') {
    throw new Error('The existing ELS subject name does not match the approved subject.');
  }

  const existingLessons = await Lesson.find({ subject: subject._id }).lean();
  const existingByLessonNumber = new Map(existingLessons.map((lesson) => [lesson.lessonNumber, lesson]));

  for (const content of elsLessons) {
    const filter = { subject: subject._id, lessonNumber: content.lessonNumber };
    const values = {
      title: content.title,
      overview: content.overview,
      lesson: content.lesson,
      discussion: content.discussion,
      example: content.example,
      keyConcepts: content.keyConcepts,
      keyTakeaway: content.keyTakeaway,
      contentStatus: 'ready',
      isPublished: true,
    };
    const existing = existingByLessonNumber.get(content.lessonNumber);

    if (existing) {
      const changedValues = Object.fromEntries(
        Object.entries(values).filter(([field, value]) => !isDeepStrictEqual(existing[field], value)),
      );
      if (Object.keys(changedValues).length > 0) {
        await Lesson.updateOne(filter, { $set: changedValues }, { runValidators: true });
        existingByLessonNumber.set(content.lessonNumber, { ...existing, ...changedValues });
      }
      continue;
    }

    await Lesson.updateOne(
      filter,
      { $set: values, $setOnInsert: { subject: subject._id, lessonNumber: content.lessonNumber } },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
  }

  const expectedSubjects = await Subject.find({ code: { $in: catalogCodes } }).lean();
  assert.equal(expectedSubjects.length, 4, 'Expected the four existing READSMART subjects.');
  assert.equal(await Subject.countDocuments(), 4, 'The reading database must contain exactly four subjects.');
  assert.equal(await Subject.countDocuments({ code: 'ELS' }), 1, 'There must be exactly one ELS subject.');
  const subjectIds = expectedSubjects.map(({ _id }) => _id);
  const allLessons = await Lesson.find({ subject: { $in: subjectIds } }).lean();
  assert.equal(allLessons.length, 40, 'The four-subject reading catalog must remain at 40 lessons.');
  const totalLessonCount = await Lesson.countDocuments();
  assert.equal(totalLessonCount, 40, 'The database must contain exactly 40 lessons with no duplicates.');

  const subjectById = new Map(expectedSubjects.map((item) => [String(item._id), item]));
  const counts = Object.fromEntries(catalogCodes.map((code) => [code, { total: 0, published: 0, pending: 0 }]));
  for (const lesson of allLessons) {
    const owner = subjectById.get(String(lesson.subject));
    assert.ok(owner && counts[owner.code], 'Every lesson must belong to one of the four catalog subjects.');
    counts[owner.code].total += 1;
    if (lesson.isPublished && lesson.contentStatus === 'ready') counts[owner.code].published += 1;
    if (!lesson.isPublished && lesson.contentStatus === 'pending') counts[owner.code].pending += 1;
  }

  for (const code of catalogCodes) assert.equal(counts[code].total, 10, `${code} must have exactly 10 lessons.`);
  for (const code of catalogCodes) {
    assert.equal(counts[code].published, 10, `All ${code} lessons must be ready and published.`);
    assert.equal(counts[code].pending, 0, `${code} must have no pending lessons.`);
  }

  const importedElsLessons = allLessons
    .filter((lesson) => String(lesson.subject) === String(subject._id))
    .sort((left, right) => left.lessonNumber - right.lessonNumber);
  for (const content of elsLessons) {
    const record = importedElsLessons[content.lessonNumber - 1];
    assert.equal(record.lessonNumber, content.lessonNumber);
    for (const field of ['title', 'overview', 'lesson', 'discussion', 'example', 'keyTakeaway']) {
      assert.equal(record[field], content[field], `Stored ${field} must match ELS lesson ${content.lessonNumber}.`);
    }
    assert.deepEqual(record.keyConcepts, content.keyConcepts);
    assert.equal(record.isPublished, true);
    assert.equal(record.contentStatus, 'ready');
    if (existingByLessonNumber.has(content.lessonNumber)) {
      assert.equal(String(record._id), String(existingByLessonNumber.get(content.lessonNumber)._id),
        `ELS lesson ${content.lessonNumber} should keep its existing database ID.`);
    }
  }

  const duplicateGroups = await Lesson.aggregate([
    { $group: { _id: { subject: '$subject', lessonNumber: '$lessonNumber' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);
  assert.equal(duplicateGroups.length, 0, 'Duplicate subject/lesson number records must not exist.');

  return { subjectCount: expectedSubjects.length, totalLessonCount, counts };
}

async function main() {
  try {
    await connectDatabase(getConfig().mongoUri);
    const result = await applyElsContentImport();
    console.log(`ELS content import verified: ${result.counts.ELS.published} ELS lessons published; ${result.totalLessonCount} lessons across ${result.subjectCount} subjects.`);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`ELS content import failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { applyElsContentImport, validateSourceContent };
