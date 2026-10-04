const crypto = require('node:crypto');
const Lesson = require('../models/Lesson');
const WritingActivity = require('../models/WritingActivity');
const WritingSubmission = require('../models/WritingSubmission');
const { AppError } = require('../utils/AppError');

const publishedLessonFilter = { isPublished: true, contentStatus: 'ready' };

function createFeedbackContext({ lesson, activity, submission }) {
  return {
    lesson: {
      title: lesson.title,
      overview: lesson.overview || '',
      content: lesson.lesson || '',
      keyConcepts: Array.isArray(lesson.keyConcepts) ? lesson.keyConcepts : [],
      keyTakeaway: lesson.keyTakeaway || '',
    },
    writingPrompt: activity.prompt,
    studentResponse: submission.response,
    officialRubricResult: {
      scores: submission.rubricScores,
      criterionFeedback: submission.criterionFeedback,
      totalScore: submission.totalScore,
      maxScore: submission.maxScore,
      percentage: submission.percentage,
      feedback: submission.feedback,
    },
  };
}

async function generateWritingFeedback(userId, lessonId, submissionId, aiService) {
  const submission = await WritingSubmission.findOne({ _id: submissionId, user: userId, lesson: lessonId }).lean();
  if (!submission) {
    throw new AppError('This writing submission is not available.', 404, 'WRITING_SUBMISSION_NOT_FOUND');
  }

  const [lesson, activity] = await Promise.all([
    Lesson.findOne({ _id: lessonId, ...publishedLessonFilter })
      .select('title overview lesson keyConcepts keyTakeaway')
      .lean(),
    WritingActivity.findOne({ _id: submission.writingActivity, lesson: lessonId, isPublished: true })
      .select('prompt title')
      .lean(),
  ]);
  if (!lesson || !activity) {
    throw new AppError('This writing submission is not available.', 404, 'WRITING_SUBMISSION_NOT_FOUND');
  }

  const context = createFeedbackContext({ lesson, activity, submission });
  const contextHash = crypto.createHash('sha256').update(JSON.stringify(context)).digest('hex');
  const hasCachedFeedback = submission.aiFeedback
    && submission.aiFeedbackContentHash === contextHash
    && submission.aiFeedbackPromptVersion === aiService.promptVersion
    && (!aiService.model || submission.aiFeedbackModel === aiService.model);
  if (hasCachedFeedback) {
    return {
      submissionId: String(submission._id),
      feedback: submission.aiFeedback,
      generatedAt: submission.aiFeedbackGeneratedAt,
      cached: true,
    };
  }

  const feedback = await aiService.generateWritingFeedback(context);
  const generatedAt = new Date();
  const updated = await WritingSubmission.findOneAndUpdate(
    { _id: submissionId, user: userId, lesson: lessonId },
    {
      $set: {
        aiFeedback: feedback,
        aiFeedbackContentHash: contextHash,
        aiFeedbackModel: aiService.model || 'configured-provider',
        aiFeedbackPromptVersion: aiService.promptVersion,
        aiFeedbackGeneratedAt: generatedAt,
      },
    },
    { new: true, runValidators: true },
  ).select('aiFeedback aiFeedbackGeneratedAt').lean();
  if (!updated) throw new AppError('This writing submission is not available.', 404, 'WRITING_SUBMISSION_NOT_FOUND');

  return {
    submissionId: String(submissionId),
    feedback: updated.aiFeedback,
    generatedAt: updated.aiFeedbackGeneratedAt,
    cached: false,
  };
}

module.exports = { createFeedbackContext, generateWritingFeedback };
