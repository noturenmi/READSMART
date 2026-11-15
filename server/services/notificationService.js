const DailyLearningGoal = require('../models/DailyLearningGoal');
const Notification = require('../models/Notification');
const dailyGoalService = require('./dailyGoalService');
const { AppError } = require('../utils/AppError');

let indexInitialization;

function ensureNotificationIndexes() {
  if (!indexInitialization) {
    indexInitialization = Notification.createIndexes().catch((error) => {
      indexInitialization = undefined;
      throw error;
    });
  }
  return indexInitialization;
}

async function createOnce({ userId, title, message, type, dedupeKey, relatedRecordId, relatedLesson, relatedDateKey }) {
  const values = {
    user: userId,
    title,
    message,
    type,
    dedupeKey,
    ...(relatedRecordId ? { relatedRecordId } : {}),
    ...(relatedLesson ? { relatedLesson } : {}),
    ...(relatedDateKey ? { relatedDateKey } : {}),
  };
  try {
    // Ensure the unique (user, dedupeKey) constraint is active before concurrent event writes.
    await ensureNotificationIndexes();
    return await Notification.findOneAndUpdate(
      { user: userId, dedupeKey },
      { $setOnInsert: values },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    ).lean();
  } catch (error) {
    if (error?.code !== 11000) throw error;
    return Notification.findOne({ user: userId, dedupeKey }).lean();
  }
}

async function createAssessmentResult({ userId, attemptId, lessonId }) {
  return createOnce({
    userId,
    title: 'Assessment results are ready',
    message: 'Your assessment results are now available. Check your latest score and review any incorrect answers.',
    type: 'assessment_result',
    dedupeKey: `assessment-result:${attemptId}`,
    relatedRecordId: attemptId,
    relatedLesson: lessonId,
  });
}

async function createWritingFeedback({ userId, submissionId, lessonId }) {
  return createOnce({
    userId,
    title: 'Writing feedback is ready',
    message: 'Your writing activity has been evaluated. View your rubric results and feedback.',
    type: 'writing_feedback',
    dedupeKey: `writing-feedback:${submissionId}`,
    relatedRecordId: submissionId,
    relatedLesson: lessonId,
  });
}

async function ensureDailyGoalReminder(userId, now = new Date()) {
  const dateKey = dailyGoalService.getDateKey(now);
  const record = await DailyLearningGoal.findOne({ user: userId, dateKey }).select('_id').lean();
  if (!record) return null;

  const dailyGoal = await dailyGoalService.getTodayGoals(userId, now);
  if (dailyGoal.remainingGoals === 0) return null;
  return createOnce({
    userId,
    title: 'A learning goal is still unfinished',
    message: 'You still have an unfinished learning goal for today. Continue when you are ready.',
    type: 'learning_reminder',
    dedupeKey: `daily-goal-reminder:${dateKey}`,
    relatedDateKey: dateKey,
  });
}

async function notifyDailyGoalCompletion(userId, now = new Date()) {
  const dateKey = dailyGoalService.getDateKey(now);
  const record = await DailyLearningGoal.findOne({ user: userId, dateKey }).select('_id').lean();
  if (!record) return null;

  const dailyGoal = await dailyGoalService.getTodayGoals(userId, now);
  if (!dailyGoal.totalGoals || dailyGoal.completedGoals !== dailyGoal.totalGoals) return null;
  return createOnce({
    userId,
    title: 'Daily learning goals complete',
    message: 'You completed all of your learning goals for today. Take a moment to reflect on what you learned.',
    type: 'learning_milestone',
    dedupeKey: `daily-goal-completed:${dateKey}`,
    relatedDateKey: dateKey,
  });
}

async function listNotifications(userId, { page = 1, limit = 25 } = {}) {
  const filter = { user: userId };
  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .populate({ path: 'relatedLesson', select: 'title' })
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ ...filter, isRead: false }),
  ]);
  return {
    notifications: notifications.map((item) => ({
      id: String(item._id),
      title: item.title,
      message: item.message,
      type: item.type,
      relatedRecordId: item.relatedRecordId ? String(item.relatedRecordId) : null,
      lesson: item.relatedLesson ? { id: String(item.relatedLesson._id), title: item.relatedLesson.title } : null,
      relatedDateKey: item.relatedDateKey || null,
      isRead: item.isRead,
      createdAt: item.createdAt,
    })),
    unreadCount,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

async function getUnreadCount(userId) {
  return { unreadCount: await Notification.countDocuments({ user: userId, isRead: false }) };
}

async function markAsRead(userId, notificationId) {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, user: userId },
    { $set: { isRead: true } },
    { new: true },
  ).lean();
  if (!notification) throw new AppError('This notification could not be found.', 404, 'NOTIFICATION_NOT_FOUND');
  return { id: String(notification._id), isRead: notification.isRead };
}

async function markAllAsRead(userId) {
  const result = await Notification.updateMany({ user: userId, isRead: false }, { $set: { isRead: true } });
  return { modifiedCount: result.modifiedCount || 0, unreadCount: 0 };
}

module.exports = {
  createAssessmentResult,
  createWritingFeedback,
  ensureDailyGoalReminder,
  getUnreadCount,
  listNotifications,
  markAllAsRead,
  markAsRead,
  notifyDailyGoalCompletion,
};
