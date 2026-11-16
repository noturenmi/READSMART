const crypto = require('node:crypto');
const Lesson = require('../models/Lesson');
const LessonSummary = require('../models/LessonSummary');
const { AppError } = require('../utils/AppError');
const { summarySchema } = require('./aiService');

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

async function getSummaryContext(lessonId) {
  const lesson = await Lesson.findOne({ _id: lessonId, ...publishedLessonFilter })
    .select('title overview lesson discussion example keyConcepts keyTakeaway')
    .lean();
  if (!lesson) throw new AppError('This lesson is not available.', 404, 'LESSON_NOT_FOUND');

  const content = getLessonContent(lesson);
  const sourceText = [
    content.title,
    content.overview,
    content.lesson,
    content.discussion,
    content.example,
    ...content.keyConcepts,
    content.keyTakeaway,
  ].join(' ').trim();
  if (!sourceText) throw new AppError('This lesson does not contain text to summarize.', 422, 'AI_INPUT_EMPTY');
  const contentHash = crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex');
  return { content, contentHash };
}

function isCurrentCache(cached, contentHash, aiService) {
  return Boolean(cached
    && cached.contentHash === contentHash
    && cached.promptVersion === aiService.promptVersion
    && (!aiService.model || cached.model === aiService.model)
    && summarySchema.safeParse(cached.summary).success);
}

function formatCachedResult(lessonId, cached) {
  if (!cached) {
    return { lessonId: String(lessonId), summary: null, generatedAt: null, cached: false };
  }
  return { lessonId: String(lessonId), summary: cached.summary, generatedAt: cached.generatedAt, cached: true };
}

async function getCachedLessonSummary(lessonId, aiService) {
  const { contentHash } = await getSummaryContext(lessonId);
  const cached = await LessonSummary.findOne({ lesson: lessonId }).lean();
  return formatCachedResult(lessonId, isCurrentCache(cached, contentHash, aiService) ? cached : null);
}

async function generateLessonSummary(lessonId, aiService, { regenerate = false } = {}) {
  const { content, contentHash } = await getSummaryContext(lessonId);
  const cached = await LessonSummary.findOne({ lesson: lessonId }).lean();
  if (!regenerate && isCurrentCache(cached, contentHash, aiService)) {
    return formatCachedResult(lessonId, cached);
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

module.exports = { generateLessonSummary, getCachedLessonSummary, getLessonContent };
