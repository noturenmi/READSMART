const mongoose = require('mongoose');
const AssessmentAttempt = require('../models/AssessmentAttempt');
const User = require('../models/User');
const WritingSubmission = require('../models/WritingSubmission');
const progressService = require('./progressService');
const { AppError } = require('../utils/AppError');

const HISTORY_LIMIT = 200;
const RUBRIC_KEYS = ['grammar', 'vocabulary', 'organization', 'coherence', 'developmentOfIdeas'];

function validDate(value) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date : null;
}

function timestampFor(record) {
  const submittedAt = validDate(record.submittedAt);
  if (submittedAt) return { date: submittedAt, source: 'submittedAt' };
  const createdAt = validDate(record.createdAt);
  if (createdAt) return { date: createdAt, source: 'createdAt' };
  return { date: null, source: null };
}

function lessonContext(lesson) {
  if (!lesson) return null;
  const subject = lesson.subject && typeof lesson.subject === 'object' ? lesson.subject : null;
  return {
    id: String(lesson._id),
    title: lesson.title || 'Lesson details unavailable',
    lessonNumber: Number.isInteger(lesson.lessonNumber) ? lesson.lessonNumber : null,
    subject: subject ? {
      id: String(subject._id),
      name: subject.name || 'Subject unavailable',
      code: subject.code || null,
    } : null,
  };
}

function completeAssessment(attempt) {
  if (!Array.isArray(attempt.answers)
    || !Number.isInteger(attempt.totalItems)
    || attempt.totalItems < 1
    || attempt.answers.length !== attempt.totalItems
    || !Number.isInteger(attempt.totalPoints)
    || attempt.totalPoints < 1
    || !Number.isInteger(attempt.score)
    || attempt.score < 0
    || attempt.score > attempt.totalPoints
    || !Number.isInteger(attempt.percentage)
    || attempt.percentage !== Math.round((attempt.score / attempt.totalPoints) * 100)) return false;
  return attempt.answers.every((answer) => Number.isInteger(answer.pointsEarned) && answer.pointsEarned >= 0)
    && attempt.answers.reduce((sum, answer) => sum + answer.pointsEarned, 0) === attempt.score;
}

function assessmentQuestionSetSignature(attempt) {
  // Per-question maximum points are not snapshotted on the attempt. Requiring
  // totalPoints === totalItems proves every item had the same one-point weight.
  if (!completeAssessment(attempt) || attempt.totalPoints !== attempt.totalItems) return null;
  const snapshots = attempt.answers.map((answer) => {
    if (!answer.questionId
      || typeof answer.questionText !== 'string'
      || !answer.questionText.trim()
      || !Array.isArray(answer.choices)
      || answer.choices.length !== 4
      || answer.choices.some((choice) => typeof choice !== 'string' || !choice.trim())
      || !Number.isInteger(answer.correctAnswer)
      || answer.correctAnswer < 0
      || answer.correctAnswer > 3
      || !Number.isInteger(answer.order)
      || answer.order < 1) return null;
    return {
      questionId: String(answer.questionId),
      questionText: answer.questionText,
      choices: answer.choices,
      correctAnswer: answer.correctAnswer,
      questionType: answer.questionType || null,
      order: answer.order,
    };
  });
  if (snapshots.some((snapshot) => !snapshot)) return null;
  snapshots.sort((left, right) => left.order - right.order || left.questionId.localeCompare(right.questionId));
  return JSON.stringify({
    totalItems: attempt.totalItems,
    totalPoints: attempt.totalPoints,
    questions: snapshots,
  });
}

function isComparableAssessment(attempt) {
  return Boolean(attempt.lesson && timestampFor(attempt).date && assessmentQuestionSetSignature(attempt));
}

function comparableWritingScore(submission) {
  const scores = submission.rubricScores;
  if (!scores || submission.maxScore !== 25 || !Number.isInteger(submission.totalScore)
    || submission.totalScore < 5 || submission.totalScore > 25) return false;
  const values = RUBRIC_KEYS.map((key) => scores[key]);
  return values.every((score) => Number.isInteger(score) && score >= 1 && score <= 5)
    && values.reduce((sum, score) => sum + score, 0) === submission.totalScore
    && submission.percentage === Math.round((submission.totalScore / 25) * 100);
}

function isComparableWritingSubmission(submission) {
  const submissionDate = timestampFor(submission).date;
  const editedAt = validDate(submission.writingActivity?.updatedAt);
  return Boolean(
    submission.lesson
      && submission.writingActivity
      && submissionDate
      && editedAt
      && submissionDate >= editedAt
      && comparableWritingScore(submission),
  );
}

function assessmentChange(attempts) {
  if (attempts.length < 2) return null;
  const previous = attempts[attempts.length - 2];
  const latest = attempts[attempts.length - 1];
  const scoreDelta = latest.score - previous.score;
  const percentagePointDelta = latest.percentage - previous.percentage;
  return {
    status: scoreDelta > 0 ? 'increased' : scoreDelta < 0 ? 'decreased' : 'unchanged',
    previousScore: previous.score,
    latestScore: latest.score,
    scoreDelta,
    percentagePointDelta,
    label: 'Score change between comparable attempts; this alone does not confirm learning improvement.',
  };
}

function writingChange(submissions) {
  if (submissions.length < 2) return null;
  const previous = submissions[submissions.length - 2];
  const latest = submissions[submissions.length - 1];
  const scoreDelta = latest.score - previous.score;
  return {
    status: scoreDelta > 0 ? 'increased' : scoreDelta < 0 ? 'decreased' : 'unchanged',
    previousScore: previous.score,
    latestScore: latest.score,
    scoreDelta,
    percentagePointDelta: latest.percentage - previous.percentage,
    label: 'Score change on the same writing activity and 25-point rubric; this alone does not confirm learning improvement.',
  };
}

function buildAssessmentTrends(attempts) {
  const groups = new Map();
  for (const attempt of attempts) {
    const signature = assessmentQuestionSetSignature(attempt);
    if (!signature || !attempt.lesson || !timestampFor(attempt).date) continue;
    const key = `${String(attempt.lesson._id)}:${signature}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(attempt);
  }
  return [...groups.values()].map((group) => {
    const context = lessonContext(group[0].lesson);
    const ordered = group.map((attempt) => {
      const { date, source } = timestampFor(attempt);
      return {
        id: String(attempt._id),
        submittedAt: date ? date.toISOString() : null,
        timestampSource: source,
        score: attempt.score,
        totalPoints: attempt.totalPoints,
        totalItems: attempt.totalItems,
        percentage: attempt.percentage,
      };
    }).sort((left, right) => left.submittedAt.localeCompare(right.submittedAt) || left.id.localeCompare(right.id));
    const recentAttempts = ordered.slice(-6);
    return {
      lesson: context,
      scale: { type: 'raw_points_and_percentage', totalPoints: group[0].totalPoints, totalItems: group[0].totalItems },
      comparability: 'same_lesson_and_identical_saved_question_set',
      attempts: recentAttempts,
      attemptCount: ordered.length,
      omittedAttemptCount: Math.max(0, ordered.length - recentAttempts.length),
      change: assessmentChange(ordered),
    };
  }).sort((left, right) => (
    (right.attempts.at(-1)?.submittedAt || '').localeCompare(left.attempts.at(-1)?.submittedAt || '')
    || String(left.lesson?.id).localeCompare(String(right.lesson?.id))
  ));
}

function buildWritingTrends(submissions) {
  const groups = new Map();
  for (const submission of submissions) {
    // Submissions do not snapshot the prompt or rubric configuration. Only
    // compare records known to have been submitted after the latest edit.
    if (!isComparableWritingSubmission(submission)) continue;
    const key = `${String(submission.writingActivity._id)}:25`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(submission);
  }
  return [...groups.values()].map((group) => {
    const ordered = group.map((submission) => {
      const { date, source } = timestampFor(submission);
      return {
        id: String(submission._id),
        submittedAt: date ? date.toISOString() : null,
        timestampSource: source,
        score: submission.totalScore,
        maxScore: submission.maxScore,
        percentage: submission.percentage,
      };
    }).sort((left, right) => left.submittedAt.localeCompare(right.submittedAt) || left.id.localeCompare(right.id));
    const recentSubmissions = ordered.slice(-6);
    const activity = group[0].writingActivity;
    return {
      writingActivity: { id: String(activity._id), title: activity.title || 'Writing activity unavailable' },
      lesson: lessonContext(group[0].lesson),
      scale: { type: 'rubric_points', maxScore: 25, criteria: RUBRIC_KEYS },
      comparability: 'same_writing_activity_and_25_point_rubric',
      currentActivityVersionSince: validDate(activity.updatedAt)?.toISOString() || null,
      submissions: recentSubmissions,
      submissionCount: ordered.length,
      omittedSubmissionCount: Math.max(0, ordered.length - recentSubmissions.length),
      change: writingChange(ordered),
    };
  }).sort((left, right) => (
    (right.submissions.at(-1)?.submittedAt || '').localeCompare(left.submissions.at(-1)?.submittedAt || '')
    || String(left.writingActivity.id).localeCompare(String(right.writingActivity.id))
  ));
}

function serializeAssessment(attempt) {
  const { date, source } = timestampFor(attempt);
  const complete = completeAssessment(attempt);
  return {
    id: String(attempt._id),
    lesson: lessonContext(attempt.lesson),
    submittedAt: date ? date.toISOString() : null,
    timestampSource: source,
    resultAvailable: complete,
    score: complete ? { raw: attempt.score, totalPoints: attempt.totalPoints, totalItems: attempt.totalItems, percentage: attempt.percentage } : null,
  };
}

function serializeWritingSubmission(submission) {
  const { date, source } = timestampFor(submission);
  const resultAvailable = comparableWritingScore(submission);
  const activity = submission.writingActivity && typeof submission.writingActivity === 'object'
    ? { id: String(submission.writingActivity._id), title: submission.writingActivity.title || 'Writing activity unavailable' }
    : null;
  const feedback = typeof submission.feedback === 'string' ? submission.feedback : '';
  return {
    id: String(submission._id),
    lesson: lessonContext(submission.lesson),
    writingActivity: activity,
    submittedAt: date ? date.toISOString() : null,
    timestampSource: source,
    responsePreview: typeof submission.response === 'string' ? submission.response.trim().slice(0, 220) : '',
    resultAvailable,
    comparisonAvailable: isComparableWritingSubmission(submission),
    score: resultAvailable ? {
      raw: submission.totalScore,
      maxScore: submission.maxScore,
      percentage: submission.percentage,
      rubricScores: Object.fromEntries(RUBRIC_KEYS.map((key) => [key, submission.rubricScores[key]])),
      criterionFeedback: submission.criterionFeedback || null,
      feedback,
    } : null,
  };
}

async function getLearningReport(userId, { progressSnapshot } = {}) {
  if (!mongoose.Types.ObjectId.isValid(String(userId))) {
    throw new AppError('A valid student ID is required.', 400, 'INVALID_USER_ID');
  }
  const userExists = await User.exists({ _id: userId, role: 'student' });
  if (!userExists) throw new AppError('This student account was not found.', 404, 'STUDENT_NOT_FOUND');

  const userObjectId = new mongoose.Types.ObjectId(String(userId));
  const progressSnapshotPromise = progressSnapshot
    ? Promise.resolve(progressSnapshot)
    : progressService.getProgressSnapshot(userId);
  const [attemptCount, submissionCount, attempts, submissions, currentProgressSnapshot] = await Promise.all([
    AssessmentAttempt.countDocuments({ user: userObjectId }),
    WritingSubmission.countDocuments({ user: userObjectId }),
    AssessmentAttempt.find({ user: userObjectId })
      .sort({ submittedAt: -1, createdAt: -1, _id: -1 })
      .limit(HISTORY_LIMIT)
      .select('lesson score totalItems totalPoints percentage submittedAt createdAt answers.questionId answers.pointsEarned')
      .select('+answers.questionText +answers.choices +answers.correctAnswer +answers.questionType +answers.order')
      .populate({ path: 'lesson', select: 'title lessonNumber subject', populate: { path: 'subject', select: 'name code' } })
      .lean(),
    WritingSubmission.find({ user: userObjectId })
      .sort({ submittedAt: -1, createdAt: -1, _id: -1 })
      .limit(HISTORY_LIMIT)
      .select('lesson writingActivity response totalScore maxScore percentage rubricScores criterionFeedback feedback submittedAt createdAt')
      .populate({ path: 'writingActivity', select: 'title updatedAt' })
      .populate({ path: 'lesson', select: 'title lessonNumber subject', populate: { path: 'subject', select: 'name code' } })
      .lean(),
    progressSnapshotPromise,
  ]);

  const byEffectiveDateDescending = (left, right) => {
    const leftDate = timestampFor(left).date?.getTime() || 0;
    const rightDate = timestampFor(right).date?.getTime() || 0;
    return rightDate - leftDate || String(right._id).localeCompare(String(left._id));
  };
  attempts.sort(byEffectiveDateDescending);
  submissions.sort(byEffectiveDateDescending);

  const readingResults = attempts.map((attempt) => ({
    ...serializeAssessment(attempt),
    comparisonAvailable: isComparableAssessment(attempt),
  }));
  const writingResults = submissions.map(serializeWritingSubmission);
  const readingTrends = buildAssessmentTrends(attempts);
  const writingTrends = buildWritingTrends(submissions);
  const latestReading = readingResults.find(({ resultAvailable, submittedAt }) => resultAvailable && submittedAt) || null;
  const latestWriting = writingResults.find(({ resultAvailable, submittedAt }) => resultAvailable && submittedAt) || null;
  const comparableReadingCount = attempts.filter(isComparableAssessment).length;
  const comparableWritingCount = submissions.filter(isComparableWritingSubmission).length;

  return {
    summary: {
      readingAssessmentCount: attemptCount,
      writingSubmissionCount: submissionCount,
      latestReading,
      latestWriting,
      overallProgressPercentage: currentProgressSnapshot.progress.overallProgressPercentage,
      lessonsCompleted: currentProgressSnapshot.progress.lessonsCompleted,
      totalLessons: currentProgressSnapshot.progress.totalLessons,
    },
    progress: currentProgressSnapshot.progress,
    subjects: currentProgressSnapshot.subjects,
    reading: {
      results: readingResults,
      trends: readingTrends,
      excludedFromComparisonCount: Math.max(0, attemptCount - comparableReadingCount),
      historyTruncated: attemptCount > attempts.length,
    },
    writing: {
      submissions: writingResults.slice(0, 10),
      submissionCount,
      trends: writingTrends,
      excludedFromComparisonCount: Math.max(0, submissionCount - comparableWritingCount),
      historyDisplayTruncated: writingResults.length > 10,
      historyTruncated: submissionCount > submissions.length,
    },
    comparisonNote: 'Score changes compare only the same lesson with an identical saved one-point-per-question set, or submissions for the same writing activity made after its latest edit on the existing 25-point rubric. Score increases are recorded changes, not proof of learning improvement.',
  };
}

module.exports = {
  assessmentQuestionSetSignature,
  buildAssessmentTrends,
  buildWritingTrends,
  getLearningReport,
  isComparableAssessment,
};
