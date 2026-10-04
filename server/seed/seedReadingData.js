const { getConfig } = require('../config/env');
const { connectDatabase } = require('../config/database');
const Lesson = require('../models/Lesson');
const Subject = require('../models/Subject');
const { subjects } = require('./readingCatalog');

async function applyReadingSeed() {
  await Subject.init();
  await Lesson.init();

  for (const definition of subjects) {
    await Subject.updateOne(
      { code: definition.code },
      {
        $set: { name: definition.name, order: definition.order, isActive: true },
        $setOnInsert: { code: definition.code, description: '' },
      },
      { upsert: true, runValidators: true },
    );
  }

  const subjectDocuments = await Subject.find({ code: { $in: subjects.map(({ code }) => code) } }).lean();
  const subjectByCode = new Map(subjectDocuments.map((subject) => [subject.code, subject]));

  for (const definition of subjects) {
    const subject = subjectByCode.get(definition.code);
    const operations = definition.lessons.map((title, index) => ({
      updateOne: {
        filter: { subject: subject._id, lessonNumber: index + 1 },
        update: {
          $set: { subject: subject._id, title },
          $setOnInsert: {
            lessonNumber: index + 1,
            overview: '',
            lesson: '',
            discussion: '',
            example: '',
            keyConcepts: [],
            keyTakeaway: '',
            contentStatus: 'pending',
            isPublished: false,
          },
        },
        upsert: true,
      },
    }));
    await Lesson.bulkWrite(operations, { ordered: true });
  }

  const [subjectCount, lessonCount, pendingCount] = await Promise.all([
    Subject.countDocuments({ code: { $in: subjects.map(({ code }) => code) } }),
    Lesson.countDocuments({ subject: { $in: subjectDocuments.map(({ _id }) => _id) } }),
    Lesson.countDocuments({
      subject: { $in: subjectDocuments.map(({ _id }) => _id) },
      contentStatus: 'pending',
    }),
  ]);

  return { subjectCount, lessonCount, pendingCount };
}

async function main() {
  try {
    await connectDatabase(getConfig().mongoUri);
    const result = await applyReadingSeed();
    console.log(`Reading catalog ready: ${result.subjectCount} subjects, ${result.lessonCount} lessons; ${result.pendingCount} lessons pending content.`);
  } finally {
    const mongoose = require('mongoose');
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Reading catalog seed failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { applyReadingSeed };
