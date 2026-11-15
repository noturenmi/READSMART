const AssessmentAttempt = require('../models/AssessmentAttempt');
const Lesson = require('../models/Lesson');
const Subject = require('../models/Subject');
const User = require('../models/User');
const WritingSubmission = require('../models/WritingSubmission');
const WritingActivity = require('../models/WritingActivity');

const TIME_ZONE = 'Asia/Manila';
const OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const PERIODS = ['daily', 'weekly', 'monthly', 'allTime'];

function dateParts(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]));
}

function dateKey(date) {
  const parts = dateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function rangeForDateKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day) - OFFSET_MS);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

function shiftDateKey(key, days) {
  const [year, month, day] = key.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

function getPeriodRange(period, now = new Date()) {
  if (!PERIODS.includes(period)) throw new TypeError('Unsupported analytics period.');
  const today = dateKey(now);
  if (period === 'allTime') return { start: null, end: now, timeZone: TIME_ZONE };
  const days = period === 'daily' ? 0 : period === 'weekly' ? 6 : 29;
  const start = rangeForDateKey(shiftDateKey(today, -days)).start;
  return { start, end: now, timeZone: TIME_ZONE };
}

function dateMatch(start, end) {
  const condition = { $lt: end };
  if (start) condition.$gte = start;
  return { $or: [
    { submittedAt: condition },
    { submittedAt: null, createdAt: condition },
  ] };
}

function joinedActivityPipeline(start, end, { writing = false } = {}) {
  const pipeline = [
    { $match: dateMatch(start, end) },
    { $addFields: { occurredAt: { $ifNull: ['$submittedAt', '$createdAt'] } } },
    { $lookup: { from: User.collection.name, localField: 'user', foreignField: '_id', as: 'student' } },
    { $unwind: '$student' },
    { $match: { 'student.role': 'student' } },
    { $lookup: { from: Lesson.collection.name, localField: 'lesson', foreignField: '_id', as: 'lessonRecord' } },
    { $unwind: { path: '$lessonRecord', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: Subject.collection.name, localField: 'lessonRecord.subject', foreignField: '_id', as: 'subjectRecord' } },
    { $unwind: { path: '$subjectRecord', preserveNullAndEmptyArrays: true } },
  ];
  if (writing) {
    pipeline.push(
      { $lookup: { from: WritingActivity.collection.name, localField: 'writingActivity', foreignField: '_id', as: 'activityRecord' } },
      { $unwind: { path: '$activityRecord', preserveNullAndEmptyArrays: true } },
    );
  }
  const projection = {
    user: 1,
    lessonId: { $ifNull: ['$lessonRecord._id', null] },
    subjectId: { $ifNull: ['$subjectRecord._id', null] },
    subjectName: { $ifNull: ['$subjectRecord.name', ''] },
    subjectCode: { $ifNull: ['$subjectRecord.code', ''] },
    occurredAt: 1,
    percentage: 1,
  };
  if (writing) {
    projection.activityId = { $ifNull: ['$activityRecord._id', null] };
    projection.activityLessonId = { $ifNull: ['$activityRecord.lesson', null] };
  }
  pipeline.push({ $project: projection });
  return pipeline;
}

function emptySubject(subject) {
  return {
    subjectId: String(subject._id),
    subjectCode: subject.code,
    subjectName: subject.name,
    completedLessons: 0,
    completedAssessments: 0,
    averageAssessmentScore: null,
  };
}

function roundedAverage(sum, count) {
  return count ? Math.round((sum / count) * 10) / 10 : null;
}

function bucketKey(date, period) {
  const parts = dateParts(date);
  const key = `${parts.year}-${parts.month}-${parts.day}`;
  if (period === 'daily') return `${key}T${parts.hour}`;
  if (period === 'allTime') return `${parts.year}-${parts.month}`;
  return key;
}

function makeBuckets(period, range, events) {
  const keys = [];
  if (period === 'daily') {
    const today = dateKey(range.start);
    for (let hour = 0; hour < 24; hour += 1) keys.push(`${today}T${String(hour).padStart(2, '0')}`);
  } else if (period === 'weekly' || period === 'monthly') {
    const days = period === 'weekly' ? 7 : 30;
    const lastDay = dateKey(range.end);
    const firstDay = shiftDateKey(lastDay, -(days - 1));
    for (let i = 0; i < days; i += 1) keys.push(shiftDateKey(firstDay, i));
  } else {
    const eventDates = events.map(({ occurredAt }) => occurredAt).filter((date) => date instanceof Date && Number.isFinite(date.getTime()));
    if (!eventDates.length) return [];
    const oldest = eventDates.reduce((a, b) => (a < b ? a : b));
    const firstParts = dateParts(oldest);
    const endParts = dateParts(range.end);
    let year = Number(firstParts.year);
    let month = Number(firstParts.month);
    const endYear = Number(endParts.year);
    const endMonth = Number(endParts.month);
    while (year < endYear || (year === endYear && month <= endMonth)) {
      keys.push(`${year}-${String(month).padStart(2, '0')}`);
      month += 1;
      if (month > 12) { month = 1; year += 1; }
    }
  }
  return keys.map((key) => ({
    key,
    label: period === 'daily' ? `${Number(key.slice(-2)) % 12 || 12}${Number(key.slice(-2)) < 12 ? 'a' : 'p'}`
      : period === 'allTime' ? key : key.slice(5),
    assessmentUsers: new Set(),
    writingUsers: new Set(),
    lessonUsers: new Set(),
    writingCompletions: new Set(),
    assessmentScores: [],
    writingScores: [],
    assessmentCount: 0,
  }));
}

function addKey(set, userId, itemId) {
  if (itemId) set.add(`${String(userId)}:${String(itemId)}`);
}

async function getAdminLearningAnalytics(period = 'weekly', now = new Date()) {
  if (!PERIODS.includes(period)) throw new TypeError('Unsupported analytics period.');
  const range = getPeriodRange(period, now);
  const [totalStudents, subjects, assessments, submissions] = await Promise.all([
    User.countDocuments({ role: 'student' }),
    Subject.find({}).select('_id name code order').sort({ order: 1, name: 1 }).lean(),
    AssessmentAttempt.aggregate(joinedActivityPipeline(range.start, range.end)),
    WritingSubmission.aggregate(joinedActivityPipeline(range.start, range.end, { writing: true })),
  ]);

  const activeLearners = new Set();
  const lessonCompletions = new Set();
  const writingCompletions = new Set();
  const subjectMap = new Map(subjects.map((subject) => [String(subject._id), {
    ...emptySubject(subject),
    lessonUsers: new Set(),
    scoreSum: 0,
    scoreCount: 0,
  }]));
  const events = [...assessments, ...submissions];
  const buckets = makeBuckets(period, range, events);
  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  let assessmentScoreSum = 0;
  let assessmentScoreCount = 0;
  let writingScoreSum = 0;
  let writingScoreCount = 0;

  assessments.forEach((record) => {
    const userId = String(record.user);
    activeLearners.add(userId);
    const bucket = bucketMap.get(bucketKey(record.occurredAt, period));
    if (bucket) {
      bucket.assessmentCount += 1;
      bucket.assessmentUsers.add(userId);
    }
    const hasLesson = Boolean(record.lessonId);
    if (hasLesson) {
      addKey(lessonCompletions, userId, record.lessonId);
      if (bucket) addKey(bucket.lessonUsers, userId, record.lessonId);
    }
    const subject = subjectMap.get(String(record.subjectId));
    if (subject) {
      subject.completedAssessments += 1;
      if (hasLesson) subject.lessonUsers.add(`${userId}:${String(record.lessonId)}`);
      if (Number.isFinite(record.percentage) && record.percentage >= 0 && record.percentage <= 100) {
        subject.scoreSum += record.percentage;
        subject.scoreCount += 1;
      }
    }
    if (Number.isFinite(record.percentage) && record.percentage >= 0 && record.percentage <= 100) {
      assessmentScoreSum += record.percentage;
      assessmentScoreCount += 1;
      if (bucket) bucket.assessmentScores.push(record.percentage);
    }
  });

  submissions.forEach((record) => {
    const userId = String(record.user);
    activeLearners.add(userId);
    const bucket = bucketMap.get(bucketKey(record.occurredAt, period));
    if (bucket) bucket.writingUsers.add(userId);
    const hasValidActivity = record.activityId && String(record.activityLessonId) === String(record.lessonId);
    if (hasValidActivity) {
      const completionKey = `${userId}:${String(record.activityId)}`;
      writingCompletions.add(completionKey);
      if (bucket) bucket.writingCompletions.add(completionKey);
    }
    if (record.lessonId) {
      addKey(lessonCompletions, userId, record.lessonId);
      if (bucket) addKey(bucket.lessonUsers, userId, record.lessonId);
      const subject = subjectMap.get(String(record.subjectId));
      if (subject) subject.lessonUsers.add(`${userId}:${String(record.lessonId)}`);
    }
    if (Number.isFinite(record.percentage) && record.percentage >= 0 && record.percentage <= 100) {
      writingScoreSum += record.percentage;
      writingScoreCount += 1;
      if (bucket) bucket.writingScores.push(record.percentage);
    }
  });

  const subjectsResult = [...subjectMap.values()].map((subject) => ({
    subjectId: subject.subjectId,
    subjectCode: subject.subjectCode,
    subjectName: subject.subjectName,
    completedLessons: subject.lessonUsers.size,
    completedAssessments: subject.completedAssessments,
    averageAssessmentScore: roundedAverage(subject.scoreSum, subject.scoreCount),
  }));
  const trend = buckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    activeLearners: new Set([...bucket.assessmentUsers, ...bucket.writingUsers]).size,
    completedReadingLessons: bucket.lessonUsers.size,
    completedAssessments: bucket.assessmentCount,
    completedWritingActivities: bucket.writingCompletions.size,
    averageComprehensionScore: roundedAverage(bucket.assessmentScores.reduce((sum, score) => sum + score, 0), bucket.assessmentScores.length),
    averageWritingScore: roundedAverage(bucket.writingScores.reduce((sum, score) => sum + score, 0), bucket.writingScores.length),
  }));

  return {
    period,
    timeZone: TIME_ZONE,
    range: { start: range.start?.toISOString() || null, end: range.end.toISOString() },
    summary: {
      totalStudents,
      activeLearners: activeLearners.size,
      completedReadingLessons: lessonCompletions.size,
      completedAssessments: assessments.length,
      completedWritingActivities: writingCompletions.size,
      averageComprehensionScore: roundedAverage(assessmentScoreSum, assessmentScoreCount),
      averageWritingScore: roundedAverage(writingScoreSum, writingScoreCount),
    },
    subjects: subjectsResult,
    trends: trend,
  };
}

module.exports = { PERIODS, TIME_ZONE, getAdminLearningAnalytics, getPeriodRange };
