const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { getConfig } = require('../config/env');
const { connectDatabase } = require('../config/database');
const Lesson = require('../models/Lesson');
const Subject = require('../models/Subject');
const { subjects: catalogSubjects } = require('./readingCatalog');
const cparLessons = require('./cparLessons.json');

const catalogCodes = ['MIL', 'UCSP', 'CPAR', 'ELS'];

function validateSourceContent() {
  const titles = catalogSubjects.find(({ code }) => code === 'CPAR')?.lessons || [];
  assert.equal(cparLessons.length, 10, 'CPAR import source must contain exactly 10 lesson bodies.');
  assert.equal(new Set(cparLessons.map(({ lessonNumber }) => lessonNumber)).size, 10, 'CPAR lesson numbers must not be duplicated.');
  cparLessons.forEach((lesson, index) => {
    assert.equal(lesson.lessonNumber, index + 1, 'CPAR lesson numbers must be sequential from 1 to 10.');
    assert.equal(lesson.title, titles[index], 'CPAR titles must match the existing subject catalog.');
    for (const field of ['lesson', 'discussion', 'example', 'keyTakeaway']) {
      assert.equal(typeof lesson[field], 'string');
      assert.ok(lesson[field].trim(), `CPAR lesson ${index + 1} is missing ${field}.`);
    }
    assert.ok(typeof lesson.overview === 'string' && lesson.overview.length <= 1000,
      `CPAR lesson ${index + 1} overview must fit the existing schema.`);
    assert.ok(Array.isArray(lesson.keyConcepts) && lesson.keyConcepts.length > 0,
      `CPAR lesson ${index + 1} is missing key concepts.`);
    assert.ok(lesson.keyConcepts.every((concept) => typeof concept === 'string' && concept.trim()),
      `CPAR lesson ${index + 1} contains an invalid key concept.`);
  });
}

async function applyCparContentImport() {
  validateSourceContent();
  await Subject.init();
  await Lesson.init();

  const subject = await Subject.findOne({ code: 'CPAR' });
  if (!subject) throw new Error('The existing CPAR subject was not found. Run the reading catalog seed first.');
  if (subject.name !== 'Contemporary Philippine Arts from the Regions') {
    throw new Error('The existing CPAR subject name does not match the approved subject.');
  }

  const existingLessons = await Lesson.find({ subject: subject._id }).select('_id lessonNumber').lean();
  const existingIds = new Map(existingLessons.map(({ lessonNumber, _id }) => [lessonNumber, String(_id)]));

  for (const content of cparLessons) {
    await Lesson.updateOne(
      { subject: subject._id, lessonNumber: content.lessonNumber },
      {
        $set: {
          title: content.title,
          overview: content.overview,
          lesson: content.lesson,
          discussion: content.discussion,
          example: content.example,
          keyConcepts: content.keyConcepts,
          keyTakeaway: content.keyTakeaway,
          contentStatus: 'ready',
          isPublished: true,
        },
        $setOnInsert: { subject: subject._id, lessonNumber: content.lessonNumber },
      },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
  }

  const expectedSubjects = await Subject.find({ code: { $in: catalogCodes } }).lean();
  assert.equal(expectedSubjects.length, 4, 'Expected the four existing READSMART subjects.');
  assert.equal(await Subject.countDocuments(), 4, 'The reading database must contain exactly four subjects.');
  assert.equal(await Subject.countDocuments({ code: 'CPAR' }), 1, 'There must be exactly one CPAR subject.');
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
  assert.equal(counts.MIL.published, 10, 'All MIL lessons must remain published.');
  assert.equal(counts.UCSP.published, 10, 'All UCSP lessons must remain published.');
  assert.equal(counts.CPAR.published, 10, 'All 10 CPAR lessons must be ready and published.');
  assert.equal(counts.ELS.published, 0, 'ELS must remain unpublished.');
  assert.equal(counts.ELS.pending, 10, 'All 10 ELS lessons must remain pending.');

  const importedCparLessons = allLessons
    .filter((lesson) => String(lesson.subject) === String(subject._id))
    .sort((left, right) => left.lessonNumber - right.lessonNumber);
  for (const content of cparLessons) {
    const record = importedCparLessons[content.lessonNumber - 1];
    assert.equal(record.lessonNumber, content.lessonNumber);
    for (const field of ['title', 'overview', 'lesson', 'discussion', 'example', 'keyTakeaway']) {
      assert.equal(record[field], content[field], `Stored ${field} must match CPAR lesson ${content.lessonNumber}.`);
    }
    assert.deepEqual(record.keyConcepts, content.keyConcepts);
    assert.equal(record.isPublished, true);
    assert.equal(record.contentStatus, 'ready');
    if (existingIds.has(content.lessonNumber)) {
      assert.equal(String(record._id), existingIds.get(content.lessonNumber),
        `CPAR lesson ${content.lessonNumber} should keep its existing database ID.`);
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
    const result = await applyCparContentImport();
    console.log(`CPAR content import verified: ${result.counts.CPAR.published} CPAR lessons published; ${result.totalLessonCount} lessons across ${result.subjectCount} subjects.`);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`CPAR content import failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { applyCparContentImport, validateSourceContent };
