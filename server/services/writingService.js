const mongoose = require('mongoose');
const Lesson = require('../models/Lesson');
const WritingActivity = require('../models/WritingActivity');
const WritingSubmission = require('../models/WritingSubmission');
const progressService = require('./progressService');
const achievementService = require('./achievementService');
const { AppError } = require('../utils/AppError');
const { criterionFeedback, overallFeedbackFor, ratingLabels, rubricCriteria } = require('../utils/writingRubric');

const publishedLessonFilter = { isPublished: true, contentStatus: 'ready' };
const maxScore = rubricCriteria.length * 5;
const wordPattern = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu;
const transitionPattern = /\b(?:also|because|but|consequently|finally|first|for example|for instance|furthermore|however|in addition|in contrast|next|otherwise|since|so|therefore|thus|as a result|on the other hand)\b/giu;
const supportPattern = /\b(?:because|for example|for instance|in addition|as a result|this means|this shows|such as|therefore|which means|specifically)\b/giu;
const commonWords = new Set('about after again all also among and any are because been before being between both but can could did does doing during each few for from further had has have having her here hers herself him himself his how into its itself just more most much must my myself neither nor not now off once only other our ours ourselves out over own same she should some such than that the their theirs them themselves then there these they this those through too under until very was were what when where which while who whom why will with would you your yours yourself yourselves'.split(' '));

function countWords(text) {
  return (String(text || '').match(wordPattern) || []).length;
}

function clampScore(score) {
  return Math.min(5, Math.max(1, score));
}

function evaluateRubric(response, activity) {
  const words = response.toLowerCase().match(wordPattern) || [];
  const wordCount = words.length;
  const sentences = response.trim().split(/[.!?]+|\n+/u).map((sentence) => sentence.trim()).filter(Boolean);
  const sentenceCount = sentences.length;
  const paragraphs = response.trim().split(/\n\s*\n/u).map((paragraph) => paragraph.trim()).filter(Boolean);
  const terminalPunctuation = /[.!?]["')\]]*\s*$/u.test(response.trim());

  // These surface checks only notice visible punctuation, spacing, and fragment patterns.
  // They do not identify all grammar or spelling errors and are not a grammar checker.
  const repeatedPunctuation = /([!?])\1+|\.{3,}|,{2,}/u.test(response);
  const spacingIssues = /[ \t]{2,}|[ \t]+[,;:.!?]/u.test(response);
  const shortFragments = sentences.filter((sentence) => countWords(sentence) <= 2).length;
  const fragmentRatio = sentenceCount ? shortFragments / sentenceCount : 1;
  const unpunctuatedSpans = response.split(/[.!?]+/u).map((span) => countWords(span));
  const longUnpunctuatedSpan = Math.max(0, ...unpunctuatedSpans) > 40;
  const grammarPenalties = Number(!terminalPunctuation)
    + Number(repeatedPunctuation)
    + Number(spacingIssues)
    + Number(fragmentRatio > 0.2)
    + Number(longUnpunctuatedSpan);
  const grammar = clampScore(5 - grammarPenalties);

  // Vocabulary is scored by variety among content words. No advanced-word quota is used,
  // so clear and simple word choices are not penalized.
  const contentWords = words.filter((word) => word.length >= 4 && !commonWords.has(word));
  const vocabularyWords = contentWords.length ? contentWords : words.filter((word) => word.length >= 3);
  const frequency = new Map();
  for (const word of vocabularyWords) frequency.set(word, (frequency.get(word) || 0) + 1);
  const uniqueRatio = vocabularyWords.length ? frequency.size / vocabularyWords.length : 0;
  const dominantWordRatio = vocabularyWords.length ? Math.max(0, ...frequency.values()) / vocabularyWords.length : 1;
  let vocabulary = uniqueRatio >= 0.7 ? 5
    : uniqueRatio >= 0.6 ? 4
      : uniqueRatio >= 0.48 ? 3
        : uniqueRatio >= 0.35 ? 2 : 1;
  if (dominantWordRatio > 0.3) vocabulary -= 2;
  else if (dominantWordRatio > 0.2) vocabulary -= 1;
  vocabulary = clampScore(vocabulary);

  // Paragraph count and sentence count are simple structure proxies, not semantic outlining.
  const organization = clampScore(
    paragraphs.length >= 3 && sentenceCount >= 6 ? 5
      : paragraphs.length >= 2 && sentenceCount >= 4 ? 4
        : sentenceCount >= 4 ? 3
          : sentenceCount >= 2 ? 2 : 1,
  );

  // Transition terms and sentence/paragraph boundaries are used as observable connection cues.
  const transitions = response.match(transitionPattern) || [];
  let coherence = sentenceCount >= 6 && transitions.length >= 4 ? 5
    : sentenceCount >= 5 && transitions.length >= 2 ? 4
      : sentenceCount >= 3 ? 3
        : sentenceCount >= 2 ? 2 : 1;
  if (fragmentRatio > 0.35) coherence -= 1;
  coherence = clampScore(coherence);

  // Development uses response length relative to the activity limit, sentence count, and
  // explicit explanation/example cues. It does not judge whether a claim is factually correct.
  const supportCues = response.match(supportPattern) || [];
  const minimumWords = activity.minimumWords;
  const developmentOfIdeas = clampScore(
    wordCount >= minimumWords + 75 && sentenceCount >= 6 && supportCues.length >= 2 ? 5
      : wordCount >= minimumWords + 40 && sentenceCount >= 5 && supportCues.length >= 1 ? 4
        : sentenceCount >= 4 ? 3
          : sentenceCount >= 2 ? 2 : 1,
  );

  const rubricScores = { grammar, vocabulary, organization, coherence, developmentOfIdeas };
  const totalScore = Object.values(rubricScores).reduce((sum, score) => sum + score, 0);
  const percentage = Math.round((totalScore / maxScore) * 100);
  const feedback = Object.fromEntries(
    Object.entries(rubricScores).map(([key, score]) => [key, criterionFeedback[key][score]]),
  );

  return {
    wordCount,
    rubricScores,
    criterionFeedback: feedback,
    totalScore,
    maxScore,
    percentage,
    feedback: overallFeedbackFor(percentage),
    ratingLabels,
  };
}

function serializeActivity(activity, lesson) {
  return {
    id: String(activity._id),
    lessonId: String(lesson._id),
    lessonTitle: lesson.title,
    title: activity.title,
    prompt: activity.prompt,
    instructions: activity.instructions,
    minimumWords: activity.minimumWords,
    maximumWords: activity.maximumWords,
    criteria: activity.criteria.map((criterion) => ({
      key: criterion.key,
      label: criterion.label,
      description: criterion.description,
      maximumScore: criterion.maximumScore,
    })),
    ratingLabels,
  };
}

function serializeSubmissionResult(submission, lesson, activity) {
  return {
    submissionId: String(submission._id),
    lesson: { id: String(lesson._id), title: lesson.title },
    writingActivity: { id: String(activity._id), title: activity.title },
    response: submission.response,
    wordCount: submission.wordCount,
    rubricScores: submission.rubricScores,
    criterionFeedback: submission.criterionFeedback,
    ratingLabels,
    totalScore: submission.totalScore,
    maxScore: submission.maxScore,
    percentage: submission.percentage,
    feedback: submission.feedback,
    submittedAt: submission.submittedAt,
  };
}

function submissionDate(submission) {
  const value = submission.submittedAt || submission.createdAt;
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function serializeHistoryEntry(submission, { includeResponse = false } = {}) {
  const lesson = submission.lesson && typeof submission.lesson === 'object' ? submission.lesson : null;
  const subject = lesson?.subject && typeof lesson.subject === 'object' ? lesson.subject : null;
  const activity = submission.writingActivity && typeof submission.writingActivity === 'object'
    ? submission.writingActivity
    : null;
  const hasScore = Number.isFinite(submission.totalScore) && Number.isFinite(submission.maxScore);
  const hasPercentage = Number.isFinite(submission.percentage);
  const feedback = typeof submission.feedback === 'string' && submission.feedback.trim()
    ? submission.feedback.trim()
    : null;
  const response = typeof submission.response === 'string' ? submission.response : '';
  const normalizedPreview = response.replace(/\s+/g, ' ').trim();

  return {
    id: String(submission._id),
    writingActivity: activity ? {
      id: String(activity._id),
      title: activity.title || 'Writing activity details unavailable',
      prompt: activity.prompt || null,
    } : null,
    lesson: lesson ? {
      id: String(lesson._id),
      title: lesson.title || 'Lesson details unavailable',
      lessonNumber: Number.isInteger(lesson.lessonNumber) ? lesson.lessonNumber : null,
      subject: subject ? { name: subject.name || '', code: subject.code || '' } : null,
    } : null,
    submittedAt: submission.historyDate || submissionDate(submission),
    wordCount: Number.isInteger(submission.wordCount) ? submission.wordCount : null,
    responsePreview: normalizedPreview.length > 220 ? `${normalizedPreview.slice(0, 220).trimEnd()}…` : normalizedPreview,
    response: includeResponse ? response : undefined,
    resultStatus: hasScore ? 'assessed' : 'result_unavailable',
    score: hasScore ? {
      totalScore: submission.totalScore,
      maxScore: submission.maxScore,
      percentage: hasPercentage ? submission.percentage : null,
    } : null,
    rubricScores: submission.rubricScores || null,
    criterionFeedback: submission.criterionFeedback || null,
    feedback,
    aiFeedback: includeResponse ? (submission.aiFeedback || null) : undefined,
    aiFeedbackGeneratedAt: includeResponse ? (submission.aiFeedbackGeneratedAt || null) : undefined,
  };
}

async function findPublishedLesson(lessonId) {
  const lesson = await Lesson.findOne({ _id: lessonId, ...publishedLessonFilter })
    .populate({ path: 'subject', select: 'name code' })
    .lean();
  if (!lesson) throw new AppError('This lesson is not available.', 404, 'LESSON_NOT_FOUND');
  return lesson;
}

async function getLessonWritingActivity(lessonId) {
  const lesson = await findPublishedLesson(lessonId);
  const activity = await WritingActivity.findOne({ lesson: lesson._id, isPublished: true }).lean();
  if (!activity) throw new AppError('A writing activity is not available for this lesson yet.', 404, 'WRITING_ACTIVITY_NOT_FOUND');
  return { activity: serializeActivity(activity, lesson) };
}

async function listWritingActivities(userId) {
  const lessons = await Lesson.find(publishedLessonFilter)
    .populate({ path: 'subject', select: 'name code' })
    .select('_id title lessonNumber subject')
    .sort({ subject: 1, lessonNumber: 1 })
    .lean();
  const activities = await WritingActivity.find({
    lesson: { $in: lessons.map(({ _id }) => _id) },
    isPublished: true,
  }).select('_id lesson title prompt').lean();
  const activityByLesson = new Map(activities.map((activity) => [String(activity.lesson), activity]));
  const submissions = await WritingSubmission.find({
    user: userId,
    lesson: { $in: lessons.map(({ _id }) => _id) },
  }).select('lesson submittedAt totalScore percentage').sort({ submittedAt: -1 }).lean();
  const submissionByLesson = new Map();
  for (const submission of submissions) {
    const key = String(submission.lesson);
    if (!submissionByLesson.has(key)) submissionByLesson.set(key, submission);
  }

  return {
    activities: lessons.flatMap((lesson) => {
      const activity = activityByLesson.get(String(lesson._id));
      if (!activity) return [];
      const submission = submissionByLesson.get(String(lesson._id));
      return [{
        id: String(activity._id),
        lesson: {
          id: String(lesson._id),
          title: lesson.title,
          lessonNumber: lesson.lessonNumber,
          subject: lesson.subject ? { name: lesson.subject.name, code: lesson.subject.code } : null,
        },
        title: activity.title,
        prompt: activity.prompt,
        submitted: Boolean(submission),
        latestResult: submission
          ? { totalScore: submission.totalScore, percentage: submission.percentage, submittedAt: submission.submittedAt }
          : null,
      }];
    }),
  };
}

function validateResponse(response, activity) {
  const wordCount = countWords(response);
  if (wordCount < activity.minimumWords) {
    throw new AppError(
      'Your response has ' + wordCount + ' words. Write at least ' + activity.minimumWords + ' words before submitting.',
      400,
      'BELOW_MINIMUM_WORD_COUNT',
    );
  }
  if (wordCount > activity.maximumWords) {
    throw new AppError(
      'Your response has ' + wordCount + ' words. Keep it within ' + activity.maximumWords + ' words.',
      400,
      'ABOVE_MAXIMUM_WORD_COUNT',
    );
  }
  return wordCount;
}

async function submitLessonWriting(userId, lessonId, writingActivityId, response, requestKey) {
  const lesson = await findPublishedLesson(lessonId);
  const activity = await WritingActivity.findOne({
    _id: writingActivityId,
    lesson: lesson._id,
    isPublished: true,
  }).lean();
  if (!activity) throw new AppError('This writing activity is not available for the requested lesson.', 404, 'WRITING_ACTIVITY_NOT_FOUND');

  const cleanResponse = response.trim();
  const wordCount = validateResponse(cleanResponse, activity);
  const result = evaluateRubric(cleanResponse, activity);
  const existingRequest = requestKey
    ? await WritingSubmission.findOne({ user: userId, requestKey }).lean()
    : null;
  if (existingRequest) {
    return reuseSubmissionRequest(existingRequest, userId, lesson, activity, cleanResponse);
  }

  let submission;
  try {
    submission = await WritingSubmission.create({
      user: userId,
      lesson: lesson._id,
      writingActivity: activity._id,
      requestKey,
      response: cleanResponse,
      wordCount,
      rubricScores: result.rubricScores,
      criterionFeedback: result.criterionFeedback,
      totalScore: result.totalScore,
      maxScore: result.maxScore,
      percentage: result.percentage,
      feedback: result.feedback,
      submittedAt: new Date(),
    });
  } catch (error) {
    if (error?.code !== 11000 || !requestKey) throw error;
    const concurrentRequest = await WritingSubmission.findOne({ user: userId, requestKey }).lean();
    if (!concurrentRequest) throw error;
    return reuseSubmissionRequest(concurrentRequest, userId, lesson, activity, cleanResponse);
  }
  await progressService.awardXP(userId, 'writing_activity', lesson._id, submission._id);
  await achievementService.refreshAfterCompletedActivity(userId);

  return serializeSubmissionResult(submission, lesson, activity);
}

async function reuseSubmissionRequest(submission, userId, lesson, activity, response) {
  if (String(submission.lesson) !== String(lesson._id)
    || String(submission.writingActivity) !== String(activity._id)
    || submission.response !== response) {
    throw new AppError('This submission request was already used for a different response.', 409, 'SUBMISSION_REQUEST_REUSED');
  }
  await progressService.awardXP(userId, 'writing_activity', lesson._id, submission._id);
  await achievementService.refreshAfterCompletedActivity(userId);
  return serializeSubmissionResult(submission, lesson, activity);
}

async function getLessonWritingSubmissions(userId, lessonId) {
  const lesson = await Lesson.findById(lessonId).select('_id title').lean();
  if (!lesson) throw new AppError('This lesson could not be found.', 404, 'LESSON_NOT_FOUND');
  const submissions = await WritingSubmission.find({ user: userId, lesson: lesson._id })
    .populate({ path: 'writingActivity', select: 'title' })
    .sort({ submittedAt: -1 })
    .lean();
  return {
    lesson: { id: String(lesson._id), title: lesson.title },
    submissions: submissions.map((submission) => ({
      id: String(submission._id),
      writingActivity: submission.writingActivity
        ? { id: String(submission.writingActivity._id), title: submission.writingActivity.title }
        : null,
      response: submission.response,
      wordCount: submission.wordCount,
      rubricScores: submission.rubricScores,
      criterionFeedback: submission.criterionFeedback,
      totalScore: submission.totalScore,
      maxScore: submission.maxScore,
      percentage: submission.percentage,
      feedback: submission.feedback,
      submittedAt: submission.submittedAt,
    })),
  };
}

function populatedSubmissionQuery(query) {
  return query
    .populate({ path: 'writingActivity', select: 'title prompt' })
    .populate({
      path: 'lesson',
      select: 'title lessonNumber subject',
      populate: { path: 'subject', select: 'name code' },
    });
}

async function getWritingSubmissionHistory(userId, { page = 1, limit = 20 } = {}) {
  const userObjectId = new mongoose.Types.ObjectId(String(userId));
  const [rows, total] = await Promise.all([
    WritingSubmission.aggregate([
      { $match: { user: userObjectId } },
      { $addFields: { historyDate: { $ifNull: ['$submittedAt', '$createdAt'] } } },
      { $sort: { historyDate: -1, _id: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      { $project: {
        _id: 1, writingActivity: 1, lesson: 1, response: 1, wordCount: 1,
        rubricScores: 1, criterionFeedback: 1, totalScore: 1, maxScore: 1,
        percentage: 1, feedback: 1, submittedAt: 1, createdAt: 1, historyDate: 1,
      } },
    ]),
    WritingSubmission.countDocuments({ user: userObjectId }),
  ]);
  const ids = rows.map(({ _id }) => _id);
  const documents = ids.length
    ? await populatedSubmissionQuery(WritingSubmission.find({ _id: { $in: ids }, user: userObjectId })).lean()
    : [];
  const byId = new Map(documents.map((submission) => [String(submission._id), submission]));

  return {
    submissions: rows.flatMap((row) => {
      const submission = byId.get(String(row._id));
      return submission ? [serializeHistoryEntry({ ...submission, historyDate: row.historyDate })] : [];
    }),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

async function getWritingSubmissionDetail(userId, submissionId) {
  const submission = await populatedSubmissionQuery(
    WritingSubmission.findOne({ _id: submissionId, user: userId }),
  ).lean();
  if (!submission) throw new AppError('This writing submission is not available.', 404, 'WRITING_SUBMISSION_NOT_FOUND');
  return { submission: serializeHistoryEntry(submission, { includeResponse: true }) };
}

module.exports = {
  countWords,
  evaluateRubric,
  getLessonWritingActivity,
  getLessonWritingSubmissions,
  getWritingSubmissionDetail,
  getWritingSubmissionHistory,
  listWritingActivities,
  submitLessonWriting,
};
