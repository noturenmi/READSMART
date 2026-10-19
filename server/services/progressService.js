const mongoose = require('mongoose');
const ActivityRecord = require('../models/ActivityRecord');
const AssessmentAttempt = require('../models/AssessmentAttempt');
const Lesson = require('../models/Lesson');
const ReadingQuestion = require('../models/ReadingQuestion');
const StudentProgress = require('../models/StudentProgress');
const Subject = require('../models/Subject');
const WritingActivity = require('../models/WritingActivity');
const WritingSubmission = require('../models/WritingSubmission');
const { AppError } = require('../utils/AppError');

const XP_REWARDS = Object.freeze({
  reading_assessment: 20,
  writing_activity: 25,
  lesson_completion: 5,
});
const publishedLessonFilter = { isPublished: true, contentStatus: 'ready' };

function calculateLevel(totalXP) {
  const safeXP = Number.isFinite(Number(totalXP)) ? Math.max(0, Math.floor(Number(totalXP))) : 0;
  return Math.floor(safeXP / 100) + 1;
}

function calculatePercentage(completed, total) {
  if (!total) return 0;
  return Math.round((completed / total) * 1000) / 10;
}

function asIdSet(values) {
  return new Set(values.map((value) => String(value)));
}

async function readProgressSnapshot(userId, { includeRecent = true } = {}) {
  const userObjectId = new mongoose.Types.ObjectId(String(userId));
  const subjects = await Subject.find({ isActive: true }).select('_id name code order').sort({ order: 1, name: 1 }).lean();
  const subjectIds = subjects.map(({ _id }) => _id);
  const lessons = subjectIds.length
    ? await Lesson.find({ subject: { $in: subjectIds }, ...publishedLessonFilter })
      .select('_id subject title lessonNumber')
      .sort({ lessonNumber: 1 })
      .lean()
    : [];
  const lessonIds = lessons.map(({ _id }) => _id);

  const [assessmentLessons, writingActivities] = lessonIds.length
    ? await Promise.all([
      ReadingQuestion.distinct('lesson', { lesson: { $in: lessonIds }, isPublished: true }),
      WritingActivity.find({ lesson: { $in: lessonIds }, isPublished: true }).select('_id lesson').lean(),
    ])
    : [[], []];
  const assessmentLessonSet = asIdSet(assessmentLessons);
  const activityIds = writingActivities.map(({ _id }) => _id);
  const [attemptLessons, submittedLessons, submittedWritingActivities, xpTotals, subjectXpTotals, latestAttempt, latestWriting] = await Promise.all([
    assessmentLessons.length
      ? AssessmentAttempt.distinct('lesson', { user: userObjectId, lesson: { $in: assessmentLessons } })
      : [],
    activityIds.length
      ? WritingSubmission.distinct('lesson', {
        user: userObjectId,
        lesson: { $in: lessonIds },
        writingActivity: { $in: activityIds },
      })
      : [],
    activityIds.length
      ? WritingSubmission.distinct('writingActivity', { user: userObjectId, writingActivity: { $in: activityIds } })
      : [],
    ActivityRecord.aggregate([
      { $match: { user: userObjectId } },
      { $group: { _id: null, totalXP: { $sum: '$xpEarned' } } },
    ]),
    subjectIds.length
      ? ActivityRecord.aggregate([
        { $match: { user: userObjectId, subject: { $in: subjectIds } } },
        { $group: { _id: '$subject', totalXP: { $sum: '$xpEarned' } } },
      ])
      : [],
    assessmentLessons.length
      ? AssessmentAttempt.findOne({ user: userObjectId, lesson: { $in: assessmentLessons } })
        .sort({ submittedAt: -1 }).select('submittedAt').lean()
      : null,
    activityIds.length
      ? WritingSubmission.findOne({ user: userObjectId, lesson: { $in: lessonIds }, writingActivity: { $in: activityIds } })
        .sort({ submittedAt: -1 }).select('submittedAt').lean()
      : null,
  ]);

  const readingDone = asIdSet(attemptLessons.filter((lessonId) => assessmentLessonSet.has(String(lessonId))));
  const writingDone = asIdSet(submittedLessons);
  const writingActivityDone = asIdSet(submittedWritingActivities);
  const subjectXPById = new Map(subjectXpTotals.map(({ _id, totalXP: xp }) => [String(_id), xp]));
  const completedLessonIds = new Set([...readingDone, ...writingDone]);
  const totalXP = xpTotals[0]?.totalXP || 0;
  const level = calculateLevel(totalXP);
  const lastActivityAt = [latestAttempt?.submittedAt, latestWriting?.submittedAt]
    .filter(Boolean)
    .sort((left, right) => right - left)[0] || null;
  const totalLessons = lessons.length;
  const lessonsCompleted = [...completedLessonIds].filter((lessonId) => lessons.some(({ _id }) => String(_id) === lessonId)).length;
  const overallProgressPercentage = calculatePercentage(lessonsCompleted, totalLessons);

  const progressUpdate = {
    $set: {
      totalXP,
      level,
      readingAssessmentsCompleted: readingDone.size,
      writingActivitiesCompleted: writingDone.size,
      lessonsCompleted,
      overallProgressPercentage,
      lastActivityAt,
    },
    $setOnInsert: { user: userObjectId },
  };
  let progress;
  try {
    progress = await StudentProgress.findOneAndUpdate(
      { user: userObjectId },
      progressUpdate,
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean();
  } catch (error) {
    // Concurrent first reads can both attempt the unique user upsert; retry as a normal update.
    if (error?.code !== 11000) throw error;
    progress = await StudentProgress.findOneAndUpdate(
      { user: userObjectId },
      { $set: progressUpdate.$set },
      { new: true, runValidators: true },
    ).lean();
  }

  const subjectsProgress = subjects.map((subject) => {
    const subjectLessons = lessons.filter((lesson) => String(lesson.subject) === String(subject._id));
    const subjectDone = subjectLessons.filter((lesson) => completedLessonIds.has(String(lesson._id))).length;
    const subjectLessonIds = asIdSet(subjectLessons.map(({ _id }) => _id));
    const subjectAssessmentLessons = subjectLessons.filter(({ _id }) => assessmentLessonSet.has(String(_id)));
    const subjectWritingActivities = writingActivities.filter(({ lesson }) => subjectLessonIds.has(String(lesson)));
    return {
      subjectId: String(subject._id),
      subjectCode: subject.code,
      subjectName: subject.name,
      completedLessons: subjectDone,
      totalLessons: subjectLessons.length,
      percentage: calculatePercentage(subjectDone, subjectLessons.length),
      completedReadingAssessments: subjectAssessmentLessons.filter(({ _id }) => readingDone.has(String(_id))).length,
      totalReadingAssessments: subjectAssessmentLessons.length,
      completedWritingActivities: subjectWritingActivities.filter(({ _id }) => writingActivityDone.has(String(_id))).length,
      totalWritingActivities: subjectWritingActivities.length,
      totalXP: subjectXPById.get(String(subject._id)) || 0,
    };
  });

  let recentActivities = [];
  if (includeRecent) {
    const records = await ActivityRecord.find({ user: userObjectId })
      .sort({ createdAt: -1 })
      .limit(6)
      .populate({ path: 'lesson', select: 'title lessonNumber subject', populate: { path: 'subject', select: 'name code' } })
      .select('activityType lesson xpEarned createdAt')
      .lean();
    const activityLabels = {
      reading_assessment: 'Reading Assessment Completed',
      writing_activity: 'Writing Activity Completed',
      lesson_completion: 'Lesson Completed',
    };
    recentActivities = records.map((record) => ({
      id: String(record._id),
      activityType: record.activityType,
      title: activityLabels[record.activityType],
      lesson: record.lesson ? {
        id: String(record.lesson._id),
        title: record.lesson.title,
        lessonNumber: record.lesson.lessonNumber,
        subjectName: record.lesson.subject?.name || '',
      } : null,
      xpEarned: record.xpEarned,
      completedAt: record.createdAt,
    }));
  }

  return {
    progress: {
      totalXP: progress.totalXP,
      level: progress.level,
      xpIntoLevel: progress.totalXP - ((progress.level - 1) * 100),
      nextLevelXP: progress.level * 100,
      levelProgressPercentage: calculatePercentage(progress.totalXP, progress.level * 100),
      readingAssessmentsCompleted: progress.readingAssessmentsCompleted,
      totalReadingAssessments: assessmentLessons.length,
      writingActivitiesCompleted: progress.writingActivitiesCompleted,
      totalWritingActivities: writingActivities.length,
      lessonsCompleted: progress.lessonsCompleted,
      totalLessons,
      overallProgressPercentage: progress.overallProgressPercentage,
      lastActivityAt: progress.lastActivityAt,
      recentActivities,
    },
    subjects: subjectsProgress,
  };
}

async function getStudentProgress(userId) {
  const result = await readProgressSnapshot(userId);
  return result.progress;
}

async function getSubjectProgress(userId) {
  const result = await readProgressSnapshot(userId, { includeRecent: false });
  return result.subjects;
}

async function awardXP(userId, activityType, lessonId, sourceId) {
  const xpEarned = XP_REWARDS[activityType];
  if (!xpEarned) throw new AppError('This activity cannot earn XP.', 400, 'INVALID_PROGRESS_ACTIVITY');

  const lesson = await Lesson.findOne({ _id: lessonId, ...publishedLessonFilter }).select('_id subject').lean();
  if (!lesson) throw new AppError('This lesson is not available for progress tracking.', 404, 'LESSON_NOT_FOUND');

  let awarded = false;
  try {
    await ActivityRecord.create({
      user: userId,
      activityType,
      lesson: lesson._id,
      subject: lesson.subject,
      sourceId,
      xpEarned,
    });
    awarded = true;
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }

  const progress = await getStudentProgress(userId);
  return {
    xpEarned: awarded ? xpEarned : 0,
    totalXP: progress.totalXP,
    level: progress.level,
  };
}

module.exports = {
  XP_REWARDS,
  awardXP,
  calculateLevel,
  calculatePercentage,
  getStudentProgress,
  getSubjectProgress,
};
