const mongoose = require('mongoose');
const { AppError } = require('../utils/AppError');
const { asyncHandler } = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const notificationService = require('../services/notificationService');

const objectId = /^[a-f\d]{24}$/i;

function pagination(req, _res, next) {
  const allowed = new Set(['page', 'limit']);
  if (Object.keys(req.query).some((key) => !allowed.has(key))) {
    return next(new AppError('Only page and limit can be used for notifications.', 400, 'INVALID_PAGINATION'));
  }
  const page = req.query.page === undefined ? 1 : Number(req.query.page);
  const limit = req.query.limit === undefined ? 25 : Number(req.query.limit);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 50) {
    return next(new AppError('Use a valid notification page and a limit from 1 to 50.', 400, 'INVALID_PAGINATION'));
  }
  req.pagination = { page, limit };
  return next();
}

function validateNotificationId(req, _res, next) {
  const { notificationId } = req.params;
  if (!objectId.test(notificationId) || !mongoose.Types.ObjectId.isValid(notificationId)) {
    return next(new AppError('Enter a valid notification ID.', 400, 'INVALID_NOTIFICATION_ID'));
  }
  return next();
}

const list = asyncHandler(async (req, res) => {
  await notificationService.ensureDailyGoalReminder(req.user.id);
  return sendSuccess(res, 200, await notificationService.listNotifications(req.user.id, req.pagination));
});

const unreadCount = asyncHandler(async (req, res) => {
  await notificationService.ensureDailyGoalReminder(req.user.id);
  return sendSuccess(res, 200, await notificationService.getUnreadCount(req.user.id));
});

const markRead = asyncHandler(async (req, res) => (
  sendSuccess(res, 200, await notificationService.markAsRead(req.user.id, req.params.notificationId))
));

const markAllRead = asyncHandler(async (req, res) => (
  sendSuccess(res, 200, await notificationService.markAllAsRead(req.user.id))
));

module.exports = { list, markAllRead, markRead, pagination, unreadCount, validateNotificationId };
