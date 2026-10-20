const mongoose = require('mongoose');
const { ACHIEVEMENTS } = require('../data/achievementCatalog');
const AssessmentAttempt = require('../models/AssessmentAttempt');
const Lesson = require('../models/Lesson');
const ReadingQuestion = require('../models/ReadingQuestion');
const StudentAchievement = require('../models/StudentAchievement');
const Subject = require('../models/Subject');
const WritingActivity = require('../models/WritingActivity');
const WritingSubmission = require('../models/WritingSubmission');
const { AppError } = require('../utils/AppError');

const READING_MILESTONE = 5;
const WRITING_MILESTONE = 5;
const publishedLessonFilter = { isPublished: true, contentStatus: 'ready' };

function validDate(value) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date : null;
}

function isCompleteAssessment(attempt) {
  return Array.isArray(attempt.answers)
    && Number.isInteger(attempt.totalItems)
    && attempt.totalItems > 0
    && attempt.answers.length === attempt.totalItems
    && Number.isInteger(attempt.score)
    && Number.isInteger(attempt.totalPoints)
    && attempt.totalPoints > 0
    && attempt.score >= 0
    && attempt.score <= attempt.totalPoints
    && Boolean(validDate(attempt.submittedAt));
}

function rememberEarliest(map, key, date) {
  const dateValue = validDate(date);
  if (!dateValue) return;
  const normalizedKey = String(key);
  const current = map.get(normalizedKey);
  if (!current || dateValue < current) map.set(normalizedKey, dateValue);
}

function nthDate(map, count) {
  const dates = [...map.values()].sort((left, right) => left - right);
  return dates[count - 1] || null;
}

async function readEvidence(userId) {
  const userObjectId = new mongoose.Types.ObjectId(String(userId));
  const [subjects, attempts, submissions] = await Promise.all([
    Subject.find({}).select('_id isActive').lean(),
    AssessmentAttempt.find({ user: userObjectId })
      .select('lesson answers score totalItems totalPoints submittedAt')
      .sort({ submittedAt: 1, _id: 1 })
      .lean(),
    WritingSubmission.find({ user: userObjectId })
      .select('lesson writingActivity response wordCount submittedAt')
      .sort({ submittedAt: 1, _id: 1 })
      .lean(),
  ]);

  const subjectById = new Map(subjects.map((subject) => [String(subject._id), subject]));
  const activeSubjectIds = subjects.filter(({ isActive }) => isActive).map(({ _id }) => _id);
  const writingActivityIds = [...new Set(submissions
    .map(({ writingActivity }) => writingActivity && String(writingActivity))
    .filter(Boolean))];
  const referencedLessonIds = [...new Set([
    ...attempts.map(({ lesson }) => lesson && String(lesson)),
    ...submissions.map(({ lesson }) => lesson && String(lesson)),
  ].filter(Boolean))];

  const [lessons, writingActivities] = await Promise.all([
    Lesson.find({
      $or: [
        { _id: { $in: referencedLessonIds } },
        { subject: { $in: activeSubjectIds }, ...publishedLessonFilter },
      ],
    }).select('_id subject isPublished contentStatus').lean(),
    writingActivityIds.length
      ? WritingActivity.find({ _id: { $in: writingActivityIds } }).select('_id lesson isPublished').lean()
      : [],
  ]);
  const lessonById = new Map(lessons.map((lesson) => [String(lesson._id), lesson]));
  const writingActivityById = new Map(writingActivities.map((activity) => [String(activity._id), activity]));

  const readingByLesson = new Map();
  const perfectAssessmentDates = [];
  for (const attempt of attempts) {
    const lessonId = String(attempt.lesson || '');
    if (!lessonById.has(lessonId) || !isCompleteAssessment(attempt)) continue;
    rememberEarliest(readingByLesson, lessonId, attempt.submittedAt);
    if (attempt.score === attempt.totalPoints) perfectAssessmentDates.push(validDate(attempt.submittedAt));
  }

  const writingByActivity = new Map();
  for (const submission of submissions) {
    const activityId = String(submission.writingActivity || '');
    const lessonId = String(submission.lesson || '');
    const activity = writingActivityById.get(activityId);
    if (!activity || String(activity.lesson) !== lessonId || !lessonById.has(lessonId)) continue;
    if (typeof submission.response !== 'string' || !submission.response.trim()) continue;
    if (!Number.isInteger(submission.wordCount) || submission.wordCount < 1) continue;
    rememberEarliest(writingByActivity, activityId, submission.submittedAt);
  }

  const publishedLessons = lessons.filter((lesson) => (
    lesson.isPublished
    && lesson.contentStatus === 'ready'
    && subjectById.get(String(lesson.subject))?.isActive
  ));
  const publishedLessonIds = publishedLessons.map(({ _id }) => _id);
  const [assessmentLessonIds, publishedWritingLessonIds] = publishedLessonIds.length
    ? await Promise.all([
      ReadingQuestion.distinct('lesson', { lesson: { $in: publishedLessonIds }, isPublished: true }),
      WritingActivity.distinct('lesson', { lesson: { $in: publishedLessonIds }, isPublished: true }),
    ])
    : [[], []];
  const eligibleLessonIds = new Set([
    ...assessmentLessonIds.map(String),
    ...publishedWritingLessonIds.map(String),
  ]);
  const eligibleSubjectIds = new Set(publishedLessons
    .filter(({ _id }) => eligibleLessonIds.has(String(_id)))
    .map(({ subject }) => String(subject)));

  const completedSubjectAt = new Map();
  for (const [lessonId, date] of readingByLesson) {
    const subjectId = String(lessonById.get(lessonId)?.subject || '');
    if (eligibleSubjectIds.has(subjectId)) rememberEarliest(completedSubjectAt, subjectId, date);
  }
  const writingActivityLessonById = new Map(writingActivities.map(({ _id, lesson }) => [String(_id), String(lesson)]));
  for (const [activityId, date] of writingByActivity) {
    const lessonId = writingActivityLessonById.get(activityId);
    const subjectId = String(lessonById.get(lessonId)?.subject || '');
    if (eligibleSubjectIds.has(subjectId)) rememberEarliest(completedSubjectAt, subjectId, date);
  }

  const learningDates = [...readingByLesson.values(), ...writingByActivity.values()]
    .sort((left, right) => left - right);
  const subjectDates = [...completedSubjectAt.entries()]
    .sort((left, right) => left[1] - right[1]);
  const acrossSubjectsAt = eligibleSubjectIds.size > 0 && subjectDates.length >= eligibleSubjectIds.size
    ? subjectDates[eligibleSubjectIds.size - 1][1]
    : null;

  return {
    readingByLesson,
    writingByActivity,
    learningDates,
    perfectAt: perfectAssessmentDates.sort((left, right) => left - right)[0] || null,
    acrossSubjectsAt,
    eligibleSubjectCount: eligibleSubjectIds.size,
    completedSubjectCount: Math.min(eligibleSubjectIds.size, completedSubjectAt.size),
  };
}

function achievementCandidates(evidence) {
  return new Map([
    ['first-learning-step', evidence.learningDates[0] || null],
    ['curious-reader', nthDate(evidence.readingByLesson, READING_MILESTONE)],
    ['writer-in-practice', nthDate(evidence.writingByActivity, WRITING_MILESTONE)],
    ['perfect-score', evidence.perfectAt],
    ['across-subjects', evidence.acrossSubjectsAt],
  ]);
}

async function awardEligible(userId, candidates) {
  await Promise.all([...candidates.entries()].filter(([, earnedAt]) => earnedAt).map(async ([achievementId, earnedAt]) => {
    try {
      await StudentAchievement.updateOne(
        { user: userId, achievementId },
        { $setOnInsert: { user: userId, achievementId, earnedAt } },
        { upsert: true, runValidators: true },
      );
    } catch (error) {
      // The unique user/achievement index resolves concurrent requests. Treat the
      // losing upsert as already awarded; rethrow all other persistence failures.
      if (error?.code !== 11000) throw error;
    }
  }));
}

async function getStudentAchievements(userId) {
  if (!mongoose.Types.ObjectId.isValid(String(userId))) {
    throw new AppError('A valid student ID is required.', 400, 'INVALID_USER_ID');
  }
  const evidence = await readEvidence(userId);
  const candidates = achievementCandidates(evidence);
  await awardEligible(userId, candidates);
  const awards = await StudentAchievement.find({ user: userId }).select('achievementId earnedAt').lean();
  const awardById = new Map(awards.map(({ achievementId, earnedAt }) => [achievementId, earnedAt]));

  const badges = ACHIEVEMENTS.map((achievement) => {
    let current = 0;
    let target = achievement.target;
    let label;
    if (achievement.type === 'first_learning_activity') current = Math.min(evidence.learningDates.length, 1);
    if (achievement.type === 'reading_lessons') current = Math.min(evidence.readingByLesson.size, READING_MILESTONE);
    if (achievement.type === 'writing_activities') current = Math.min(evidence.writingByActivity.size, WRITING_MILESTONE);
    if (achievement.type === 'perfect_assessment') current = evidence.perfectAt ? 1 : 0;
    if (achievement.type === 'all_subjects') {
      target = evidence.eligibleSubjectCount;
      current = evidence.completedSubjectCount;
      label = target
        ? `${current} of ${target} eligible subjects`
        : 'No active subjects have published activities yet';
    }
    const earnedAt = awardById.get(achievement.id) || null;
    const safeTarget = target > 0 ? target : 0;
    const safeCurrent = safeTarget ? Math.min(safeTarget, Math.max(0, current)) : 0;
    return {
      id: achievement.id,
      name: achievement.name,
      description: achievement.description,
      requirement: achievement.requirement,
      icon: achievement.icon,
      earned: Boolean(earnedAt),
      earnedAt,
      progress: {
        current: safeCurrent,
        target: safeTarget,
        percentage: safeTarget ? Math.round((safeCurrent / safeTarget) * 100) : 0,
        label: label || `${safeCurrent} of ${safeTarget}`,
      },
    };
  });

  return {
    badges,
    earnedCount: badges.filter(({ earned }) => earned).length,
    totalCount: badges.length,
  };
}

async function refreshAfterCompletedActivity(userId) {
  try {
    return await getStudentAchievements(userId);
  } catch (_error) {
    // Badge synchronization is retried on the next authenticated achievements
    // read; it must not turn an already-scored assessment or submission into an error.
    return null;
  }
}

module.exports = {
  getStudentAchievements,
  refreshAfterCompletedActivity,
  isCompleteAssessment,
  achievementCandidates,
  readEvidence,
  READING_MILESTONE,
  WRITING_MILESTONE,
};
