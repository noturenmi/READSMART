const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { connectDatabase } = require('../config/database');
const Lesson = require('../models/Lesson');
const Subject = require('../models/Subject');
const { applyReadingSeed } = require('../seed/seedReadingData');
const { applyMilContentImport } = require('../seed/importMilContent');
const milLessons = require('../seed/milLessons.json');

let mongoServer;

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await connectDatabase(mongoServer.getUri('readsmart_mil_import_test'));
  await applyReadingSeed();
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test('approved MIL content imports idempotently and leaves the other subjects pending', async () => {
  const first = await applyMilContentImport();
  await applyReadingSeed();
  const second = await applyMilContentImport();

  assert.equal(first.subjectCount, 4);
  assert.equal(first.totalLessonCount, 40);
  assert.equal(first.milPublishedCount, 10);
  assert.equal(second.totalLessonCount, 40);
  assert.deepEqual(second.counts, first.counts);
  assert.equal(await Subject.countDocuments(), 4);
  assert.equal(await Lesson.countDocuments(), 40);

  const mil = await Subject.findOne({ code: 'MIL' });
  const milRecords = await Lesson.find({ subject: mil._id }).sort({ lessonNumber: 1 }).lean();
  assert.equal(milRecords.length, 10);
  for (const [index, record] of milRecords.entries()) {
    const supplied = milLessons[index];
    assert.equal(record.title, supplied.title);
    assert.equal(record.lesson, supplied.lesson);
    assert.equal(record.discussion, supplied.discussion);
    assert.equal(record.example, supplied.example);
    assert.deepEqual(record.keyConcepts, supplied.keyConcepts);
    assert.equal(record.keyTakeaway, supplied.keyTakeaway);
    assert.equal(record.isPublished, true);
    assert.equal(record.contentStatus, 'ready');
  }

  const otherSubjects = await Subject.find({ code: { $in: ['UCSP', 'CPAR', 'ELS'] } });
  for (const subject of otherSubjects) {
    const records = await Lesson.find({ subject: subject._id });
    assert.equal(records.length, 10);
    assert.ok(records.every((record) => !record.isPublished && record.contentStatus === 'pending'));
  }
});
