const assert = require('node:assert/strict');
const { getConfig } = require('../config/env');
const { connectDatabase } = require('../config/database');
const Lesson = require('../models/Lesson');
const Subject = require('../models/Subject');
const { subjects: catalogSubjects } = require('./readingCatalog');
const ucspLessons = require('./ucspLessons.json');

const catalogCodes = ['MIL', 'UCSP', 'CPAR', 'ELS'];

function validateSourceContent() {
  const titles = catalogSubjects.find(({ code }) => code === 'UCSP')?.lessons || [];
  assert.equal(ucspLessons.length, 10, 'UCSP import source must contain exactly 10 lesson bodies.');
  assert.equal(new Set(ucspLessons.map(({ lessonNumber }) => lessonNumber)).size, 10, 'UCSP lesson numbers must not be duplicated.');
  ucspLessons.forEach((lesson, index) => {
    assert.equal(lesson.lessonNumber, index + 1, 'UCSP lesson numbers must be sequential from 1 to 10.');
    assert.equal(lesson.title, titles[index], 'UCSP titles must match the existing subject catalog.');
    for (const field of ['lesson', 'discussion', 'example', 'keyTakeaway']) {
      assert.equal(typeof lesson[field], 'string');
      assert.ok(lesson[field].trim(), `UCSP lesson ${index + 1} is missing ${field}.`);
    }
    assert.ok(Array.isArray(lesson.keyConcepts) && lesson.keyConcepts.length > 0, `UCSP lesson ${index + 1} is missing key concepts.`);
  });
}

async function applyUcspContentImport() {
  validateSourceContent();
  await Subject.init();
  await Lesson.init();

  const subject = await Subject.findOne({ code: 'UCSP' });
  if (!subject) throw new Error('The existing UCSP subject was not found. Run the reading catalog seed first.');
  if (subject.name !== 'Understanding Culture, Society and Politics') {
    throw new Error('The existing UCSP subject name does not match the approved subject.');
  }

  for (const content of ucspLessons) {
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
  assert.equal(counts.UCSP.published, 10, 'All 10 UCSP lessons must be ready and published.');
  for (const code of ['CPAR', 'ELS']) {
    assert.equal(counts[code].published, 0, `${code} must remain unpublished.`);
    assert.equal(counts[code].pending, 10, `${code} lessons must remain pending.`);
  }

  const importedUcspLessons = allLessons
    .filter((lesson) => String(lesson.subject) === String(subject._id))
    .sort((left, right) => left.lessonNumber - right.lessonNumber);
  for (const content of ucspLessons) {
    const record = importedUcspLessons[content.lessonNumber - 1];
    assert.equal(record.lessonNumber, content.lessonNumber);
    for (const field of ['title', 'lesson', 'discussion', 'example', 'keyTakeaway']) {
      assert.equal(record[field], content[field], `Stored ${field} must match UCSP lesson ${content.lessonNumber}.`);
    }
    assert.deepEqual(record.keyConcepts, content.keyConcepts);
    assert.equal(record.isPublished, true);
    assert.equal(record.contentStatus, 'ready');
  }

  return { subjectCount: expectedSubjects.length, totalLessonCount, counts };
}

async function main() {
  try {
    await connectDatabase(getConfig().mongoUri);
    const result = await applyUcspContentImport();
    console.log(`UCSP content import verified: ${result.counts.UCSP.published} UCSP lessons published; ${result.totalLessonCount} lessons across ${result.subjectCount} subjects.`);
  } finally {
    const mongoose = require('mongoose');
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`UCSP content import failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { applyUcspContentImport, validateSourceContent };
