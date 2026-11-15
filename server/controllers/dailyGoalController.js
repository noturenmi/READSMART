const { AppError } = require('../utils/AppError');
const { asyncHandler } = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const dailyGoalService = require('../services/dailyGoalService');
const notificationService = require('../services/notificationService');

const targetKeys = ['readingLessons', 'assessments', 'writingActivities'];

function validateTargets(req, _res, next) {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).length !== 1 || !body.targets || typeof body.targets !== 'object' || Array.isArray(body.targets)) {
    return next(new AppError('Provide target amounts for reading lessons, assessments, and writing activities.', 400, 'INVALID_DAILY_GOALS'));
  }
  const keys = Object.keys(body.targets);
  if (keys.length !== targetKeys.length || targetKeys.some((key) => !keys.includes(key))) {
    return next(new AppError('Provide all three daily goal targets.', 400, 'INVALID_DAILY_GOALS'));
  }
  const invalidTarget = targetKeys.find((key) => !Number.isInteger(body.targets[key]) || body.targets[key] < 1 || body.targets[key] > 10);
  if (invalidTarget) {
    return next(new AppError('Each daily target must be a whole number from 1 to 10.', 400, 'INVALID_DAILY_GOAL_TARGET'));
  }
  req.validatedTargets = {
    readingLessons: body.targets.readingLessons,
    assessments: body.targets.assessments,
    writingActivities: body.targets.writingActivities,
  };
  return next();
}

function validatePagination(req, _res, next) {
  const allowed = new Set(['page', 'limit']);
  if (Object.keys(req.query).some((key) => !allowed.has(key))) {
    return next(new AppError('Only page and limit can be used for daily goal history.', 400, 'INVALID_PAGINATION'));
  }
  const page = req.query.page === undefined ? 1 : Number(req.query.page);
  const limit = req.query.limit === undefined ? 14 : Number(req.query.limit);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 31) {
    return next(new AppError('Use a valid history page and a limit from 1 to 31.', 400, 'INVALID_PAGINATION'));
  }
  req.pagination = { page, limit };
  return next();
}

const getToday = asyncHandler(async (req, res) => {
  const dailyGoal = await dailyGoalService.getTodayGoals(req.user.id);
  try { await notificationService.notifyDailyGoalCompletion(req.user.id); } catch {}
  return sendSuccess(res, 200, { dailyGoal });
});

const updateToday = asyncHandler(async (req, res) => {
  const dailyGoal = await dailyGoalService.updateTodayTargets(req.user.id, req.validatedTargets);
  try { await notificationService.notifyDailyGoalCompletion(req.user.id); } catch {}
  return sendSuccess(res, 200, { dailyGoal });
});

const getHistory = asyncHandler(async (req, res) => (
  sendSuccess(res, 200, await dailyGoalService.getGoalHistory(req.user.id, req.pagination))
));

module.exports = { getHistory, getToday, updateToday, validatePagination, validateTargets };
