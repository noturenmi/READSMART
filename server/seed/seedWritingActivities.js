const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Lesson = require('../models/Lesson');
const Subject = require('../models/Subject');
const WritingActivity = require('../models/WritingActivity');
const { getConfig } = require('../config/env');
const { connectDatabase } = require('../config/database');
const { writingActivityCatalog } = require('./writingActivityCatalog');

const subjectCodes = ['MIL', 'UCSP', 'CPAR', 'ELS'];

function validateWritingCatalog() {
  assert.equal(writingActivityCatalog.length, 40, 'Writing catalog must contain one activity per lesson.');
  const counts = Object.fromEntries(subjectCodes.map((code) => [code, 0]));
  const keys = new Set();
  for (const activity of writingActivityCatalog) {
    assert.ok(counts[activity.subjectCode] !== undefined, 'Writing activity has an unknown subject code.');
    assert.ok(Number.isInteger(activity.lessonNumber) && activity.lessonNumber >= 1 && activity.lessonNumber <= 10);
    assert.ok(activity.title.trim().length >= 3 && activity.prompt.trim().length >= 10);
    assert.ok(activity.instructions.trim().length >= 10);
    assert.equal(activity.minimumWords, 100);
    assert.equal(activity.maximumWords, 250);
    assert.equal(activity.criteria.length, 5);
    assert.equal(activity.isPublished, true);
    counts[activity.subjectCode] += 1;
    const key = activity.subjectCode + ':' + activity.lessonNumber;
    assert.equal(keys.has(key), false, 'Duplicate writing activity catalog entry: ' + key);
    keys.add(key);
  }
  for (const subjectCode of subjectCodes) {
    assert.equal(counts[subjectCode], 10, subjectCode + ' must have ten writing activities.');
    for (let lessonNumber = 1; lessonNumber <= 10; lessonNumber += 1) {
      assert.ok(keys.has(subjectCode + ':' + lessonNumber), 'Missing writing activity for ' + subjectCode + ':' + lessonNumber);
    }
  }
  return counts;
}

async function applyWritingSeed() {
  const counts = validateWritingCatalog();
  await Subject.init();
  await Lesson.init();
  await WritingActivity.init();

  const subjects = await Subject.find({ code: { $in: subjectCodes }, isActive: true }).lean();
  assert.equal(subjects.length, subjectCodes.length, 'Seed all four active reading subjects before writing activities.');
  const subjectByCode = new Map(subjects.map((subject) => [subject.code, subject]));
  const lessonByKey = new Map();
  for (const subjectCode of subjectCodes) {
    const subject = subjectByCode.get(subjectCode);
    const lessons = await Lesson.find({
      subject: subject._id,
      isPublished: true,
      contentStatus: 'ready',
    }).select('_id lessonNumber').sort({ lessonNumber: 1 }).lean();
    assert.equal(lessons.length, 10, subjectCode + ' must have ten published lessons.');
    for (const lesson of lessons) lessonByKey.set(subjectCode + ':' + lesson.lessonNumber, lesson);
  }

  for (const definition of writingActivityCatalog) {
    const lesson = lessonByKey.get(definition.subjectCode + ':' + definition.lessonNumber);
    assert.ok(lesson, 'Published lesson is missing for ' + definition.subjectCode + ':' + definition.lessonNumber);
    await WritingActivity.updateOne(
      { lesson: lesson._id },
      {
        $set: {
          title: definition.title,
          prompt: definition.prompt,
          instructions: definition.instructions,
          minimumWords: definition.minimumWords,
          maximumWords: definition.maximumWords,
          criteria: definition.criteria,
          isPublished: definition.isPublished,
        },
        $setOnInsert: { lesson: lesson._id },
      },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
  }

  const lessonIds = Array.from(lessonByKey.values(), ({ _id }) => _id);
  const [activityCount, publishedCount, duplicateLessons] = await Promise.all([
    WritingActivity.countDocuments({ lesson: { $in: lessonIds } }),
    WritingActivity.countDocuments({ lesson: { $in: lessonIds }, isPublished: true }),
    WritingActivity.aggregate([
      { $match: { lesson: { $in: lessonIds } } },
      { $group: { _id: '$lesson', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ]),
  ]);
  assert.equal(activityCount, 40, 'The four reading subjects must have exactly 40 writing activities.');
  assert.equal(publishedCount, 40, 'All seeded writing activities must be published.');
  assert.equal(duplicateLessons.length, 0, 'A lesson must not have duplicate writing activities.');

  return {
    subjectCount: subjects.length,
    lessonCount: lessonByKey.size,
    activityCount,
    publishedCount,
    counts,
  };
}

async function main() {
  try {
    await connectDatabase(getConfig().mongoUri);
    const result = await applyWritingSeed();
    console.log('Writing data ready: ' + result.activityCount + ' activities (' + result.publishedCount + ' published) for ' + result.lessonCount + ' published lessons.');
    console.log('Writing activities by subject: ' + Object.entries(result.counts).map(([code, count]) => code + ' ' + count).join(', '));
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Writing activity seed failed: ' + error.message);
    process.exitCode = 1;
  });
}

module.exports = { applyWritingSeed, validateWritingCatalog };
