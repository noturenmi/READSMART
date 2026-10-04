const crypto = require('node:crypto');
const Lesson = require('../models/Lesson');
const LessonSummary = require('../models/LessonSummary');
const { AppError } = require('../utils/AppError');

const publishedLessonFilter = { isPublished: true, contentStatus: 'ready' };

function getLessonContent(lesson) {
  return {
    title: lesson.title,
    overview: lesson.overview || '',
    lesson: lesson.lesson || '',
    discussion: lesson.discussion || '',
    example: lesson.example || '',
    keyConcepts: Array.isArray(lesson.keyConcepts) ? lesson.keyConcepts : [],
    keyTakeaway: lesson.keyTakeaway || '',
  };
}

async function generateLessonSummary(lessonId, aiService) {
  const lesson = await Lesson.findOne({ _id: lessonId, ...publishedLessonFilter })
    .select('title overview lesson discussion example keyConcepts keyTakeaway')
    .lean();
  if (!lesson) throw new AppError('This lesson is not available.', 404, 'LESSON_NOT_FOUND');

  const content = getLessonContent(lesson);
  const contentHash = crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex');
  const cached = await LessonSummary.findOne({ lesson: lessonId }).lean();
  if (cached && cached.contentHash === contentHash
    && cached.promptVersion === aiService.promptVersion
    && (!aiService.model || cached.model === aiService.model)) {
    return { lessonId: String(lessonId), summary: cached.summary, generatedAt: cached.generatedAt, cached: true };
  }

  const summary = await aiService.generateLessonSummary(content);
  const generatedAt = new Date();
  const model = aiService.model || 'configured-provider';
  const saved = await LessonSummary.findOneAndUpdate(
    { lesson: lessonId },
    { $set: { contentHash, model, promptVersion: aiService.promptVersion, summary, generatedAt } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  ).lean();

  return { lessonId: String(lessonId), summary: saved.summary, generatedAt: saved.generatedAt, cached: false };
}

module.exports = { generateLessonSummary, getLessonContent };
