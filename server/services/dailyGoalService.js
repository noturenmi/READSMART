const mongoose = require('mongoose');
const AssessmentAttempt = require('../models/AssessmentAttempt');
const DailyLearningGoal = require('../models/DailyLearningGoal');
const Lesson = require('../models/Lesson');
const WritingActivity = require('../models/WritingActivity');
const WritingSubmission = require('../models/WritingSubmission');
const { AppError } = require('../utils/AppError');

const DAILY_TIME_ZONE = 'Asia/Manila';
const DAY_MS = 24 * 60 * 60 * 1000;
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DEFAULT_TARGETS = Object.freeze({ readingLessons: 1, assessments: 1, writingActivities: 1 });
const GOAL_DEFINITIONS = Object.freeze([
  { key: 'readingLessons', label: 'Reading lessons' },
  { key: 'assessments', label: 'Reading assessments' },
  { key: 'writingActivities', label: 'Writing activities' },
]);

function getDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: DAILY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getDateRange(dateKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) throw new AppError('Enter a valid calendar date.', 400, 'INVALID_DATE');
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const validationDate = new Date(Date.UTC(year, month - 1, day));
  if (validationDate.getUTCFullYear() !== year || validationDate.getUTCMonth() !== month - 1 || validationDate.getUTCDate() !== day) {
    throw new AppError('Enter a valid calendar date.', 400, 'INVALID_DATE');
  }
  const start = new Date(Date.UTC(year, month - 1, day) - MANILA_OFFSET_MS);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

function percent(completed, target) {
  return target ? Math.min(100, Math.round((Math.min(completed, target) / target) * 100)) : 0;
}

function eventDateKey(record) {
  const date = record.submittedAt || record.createdAt;
  return date instanceof Date && Number.isFinite(date.getTime()) ? getDateKey(date) : null;
}

function dateSets(dateKeys) {
  return new Map(dateKeys.map((dateKey) => [dateKey, {
    assessmentLessonIds: new Set(),
    writingActivityLessons: new Map(),
  }]));
}

async function getDailyActivityCounts(userId, dateKeys) {
  const result = new Map(dateKeys.map((dateKey) => [dateKey, { readingLessons: 0, assessments: 0, writingActivities: 0 }]));
  if (!dateKeys.length) return result;

  const dateRanges = dateKeys.map(getDateRange);
  const legacyDateQuery = { $or: dateRanges.flatMap(({ start, end }) => {
    const dateCondition = { $gte: start, $lt: end };
    return [
      { submittedAt: dateCondition },
      { submittedAt: null, createdAt: dateCondition },
    ];
  }) };
  const userObjectId = new mongoose.Types.ObjectId(String(userId));
  const [attempts, submissions] = await Promise.all([
    AssessmentAttempt.find({ user: userObjectId, ...legacyDateQuery })
      .select('lesson submittedAt createdAt')
      .lean(),
    WritingSubmission.find({ user: userObjectId, ...legacyDateQuery })
      .select('lesson writingActivity submittedAt createdAt')
      .lean(),
  ]);

  const selectedDateKeys = new Set(dateKeys);
  const dailySets = dateSets(dateKeys);
  const allLessonIds = new Set();
  const allWritingActivityIds = new Set();

  for (const attempt of attempts) {
    const dateKey = eventDateKey(attempt);
    if (!selectedDateKeys.has(dateKey) || !attempt.lesson) continue;
    const lessonId = String(attempt.lesson);
    dailySets.get(dateKey).assessmentLessonIds.add(lessonId);
    allLessonIds.add(lessonId);
  }

  for (const submission of submissions) {
    const dateKey = eventDateKey(submission);
    if (!selectedDateKeys.has(dateKey) || !submission.lesson || !submission.writingActivity) continue;
    const lessonId = String(submission.lesson);
    const activityId = String(submission.writingActivity);
    dailySets.get(dateKey).writingActivityLessons.set(activityId, lessonId);
    allLessonIds.add(lessonId);
    allWritingActivityIds.add(activityId);
  }

  const [lessons, activities] = await Promise.all([
    allLessonIds.size ? Lesson.find({ _id: { $in: [...allLessonIds] } }).select('_id').lean() : [],
    allWritingActivityIds.size
      ? WritingActivity.find({ _id: { $in: [...allWritingActivityIds] } }).select('_id lesson').lean()
      : [],
  ]);
  const existingLessonIds = new Set(lessons.map(({ _id }) => String(_id)));
  const activityById = new Map(activities.map((activity) => [String(activity._id), String(activity.lesson)]));

  for (const [dateKey, counts] of result) {
    const sets = dailySets.get(dateKey);
    const assessmentLessonIds = new Set([...sets.assessmentLessonIds].filter((lessonId) => existingLessonIds.has(lessonId)));
    const writingActivityLessons = new Map([...sets.writingActivityLessons].filter(([activityId, lessonId]) => (
      activityById.get(activityId) === lessonId && existingLessonIds.has(lessonId)
    )));
    const completedLessonIds = new Set([...assessmentLessonIds, ...writingActivityLessons.values()]);
    counts.readingLessons = completedLessonIds.size;
    counts.assessments = assessmentLessonIds.size;
    counts.writingActivities = writingActivityLessons.size;
  }

  return result;
}

function formatDailyGoal(record, counts) {
  const goals = GOAL_DEFINITIONS.map(({ key, label }) => {
    const target = record.targets[key];
    const completed = counts[key] || 0;
    return {
      key,
      label,
      target,
      completed,
      remaining: Math.max(0, target - completed),
      percentage: percent(completed, target),
      isComplete: completed >= target,
    };
  });
  const completedUnits = goals.reduce((sum, goal) => sum + Math.min(goal.completed, goal.target), 0);
  const targetUnits = goals.reduce((sum, goal) => sum + goal.target, 0);
  const completedGoals = goals.filter(({ isComplete }) => isComplete).length;
  return {
    dateKey: record.dateKey,
    timeZone: DAILY_TIME_ZONE,
    targets: {
      readingLessons: record.targets.readingLessons,
      assessments: record.targets.assessments,
      writingActivities: record.targets.writingActivities,
    },
    goals,
    completedGoals,
    totalGoals: goals.length,
    remainingGoals: goals.length - completedGoals,
    completionPercentage: targetUnits ? Math.round((completedUnits / targetUnits) * 100) : 0,
  };
}

async function ensureDailyRecord(userId, dateKey) {
  try {
    return await DailyLearningGoal.findOneAndUpdate(
      { user: userId, dateKey },
      { $setOnInsert: { user: userId, dateKey, targets: DEFAULT_TARGETS } },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    ).lean();
  } catch (error) {
    if (error?.code !== 11000) throw error;
    return DailyLearningGoal.findOne({ user: userId, dateKey }).lean();
  }
}

async function getTodayGoals(userId, now = new Date()) {
  const dateKey = getDateKey(now);
  const record = await ensureDailyRecord(userId, dateKey);
  const counts = await getDailyActivityCounts(userId, [dateKey]);
  return formatDailyGoal(record, counts.get(dateKey));
}

async function updateTodayTargets(userId, targets, now = new Date()) {
  const dateKey = getDateKey(now);
  let record;
  try {
    record = await DailyLearningGoal.findOneAndUpdate(
      { user: userId, dateKey },
      { $set: { targets }, $setOnInsert: { user: userId, dateKey } },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    ).lean();
  } catch (error) {
    if (error?.code !== 11000) throw error;
    record = await DailyLearningGoal.findOneAndUpdate(
      { user: userId, dateKey },
      { $set: { targets } },
      { new: true, runValidators: true },
    ).lean();
  }
  const counts = await getDailyActivityCounts(userId, [dateKey]);
  return formatDailyGoal(record, counts.get(dateKey));
}

async function getGoalHistory(userId, { page = 1, limit = 14 } = {}) {
  const userObjectId = new mongoose.Types.ObjectId(String(userId));
  const [records, total] = await Promise.all([
    DailyLearningGoal.find({ user: userObjectId })
      .sort({ dateKey: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    DailyLearningGoal.countDocuments({ user: userObjectId }),
  ]);
  const counts = await getDailyActivityCounts(userId, records.map(({ dateKey }) => dateKey));
  return {
    records: records.map((record) => formatDailyGoal(record, counts.get(record.dateKey))),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

module.exports = {
  DAILY_TIME_ZONE,
  DEFAULT_TARGETS,
  getDateKey,
  getDateRange,
  getGoalHistory,
  getTodayGoals,
  updateTodayTargets,
};
