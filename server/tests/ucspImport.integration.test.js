const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { connectDatabase } = require('../config/database');
const Lesson = require('../models/Lesson');
const Subject = require('../models/Subject');
const { applyReadingSeed } = require('../seed/seedReadingData');
const { applyMilContentImport } = require('../seed/importMilContent');
const { applyUcspContentImport } = require('../seed/importUcspContent');
const milLessons = require('../seed/milLessons.json');
const ucspLessons = require('../seed/ucspLessons.json');

let mongoServer;

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await connectDatabase(mongoServer.getUri('readsmart_ucsp_import_test'));
  await applyReadingSeed();
  await applyMilContentImport();
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test('UCSP import is idempotent, preserves MIL, and leaves CPAR and ELS pending', async () => {
  const first = await applyUcspContentImport();
  await applyReadingSeed();
  await applyMilContentImport();
  const second = await applyUcspContentImport();

  assert.equal(first.subjectCount, 4);
  assert.equal(first.totalLessonCount, 40);
  assert.deepEqual(second.counts, first.counts);
  assert.equal(await Subject.countDocuments(), 4);
  assert.equal(await Lesson.countDocuments(), 40);

  const ucsp = await Subject.findOne({ code: 'UCSP' });
  const ucspRecords = await Lesson.find({ subject: ucsp._id }).sort({ lessonNumber: 1 }).lean();
  assert.equal(ucspRecords.length, 10);
  assert.equal(ucspRecords.filter(({ lessonNumber }) => lessonNumber === 6).length, 1);
  for (const [index, record] of ucspRecords.entries()) {
    const supplied = ucspLessons[index];
    assert.equal(record.title, supplied.title);
    assert.equal(record.lesson, supplied.lesson);
    assert.equal(record.discussion, supplied.discussion);
    assert.equal(record.example, supplied.example);
    assert.deepEqual(record.keyConcepts, supplied.keyConcepts);
    assert.equal(record.keyTakeaway, supplied.keyTakeaway);
    assert.equal(record.isPublished, true);
    assert.equal(record.contentStatus, 'ready');
  }

  const mil = await Subject.findOne({ code: 'MIL' });
  const milRecords = await Lesson.find({ subject: mil._id }).sort({ lessonNumber: 1 }).lean();
  assert.equal(milRecords.length, 10);
  assert.ok(milRecords.every(({ isPublished, contentStatus }) => isPublished && contentStatus === 'ready'));
  assert.deepEqual(milRecords[0].keyConcepts, milLessons[0].keyConcepts);

  for (const code of ['CPAR', 'ELS']) {
    const subject = await Subject.findOne({ code });
    const records = await Lesson.find({ subject: subject._id });
    assert.equal(records.length, 10);
    assert.ok(records.every((record) => !record.isPublished && record.contentStatus === 'pending'));
  }
});
