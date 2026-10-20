const { asyncHandler } = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const progressService = require('../services/progressService');
const recommendationService = require('../services/recommendationService');
const achievementService = require('../services/achievementService');
const learningReportService = require('../services/learningReportService');

const getMyProgress = asyncHandler(async (req, res) => (
  sendSuccess(res, 200, await progressService.getStudentProgress(req.user.id))
));

const getSubjectsProgress = asyncHandler(async (req, res) => (
  sendSuccess(res, 200, { subjects: await progressService.getSubjectProgress(req.user.id) })
));

const getRecommendations = asyncHandler(async (req, res) => (
  sendSuccess(res, 200, await recommendationService.getRecommendedLessons(req.user.id))
));

const getAchievements = asyncHandler(async (req, res) => (
  sendSuccess(res, 200, await achievementService.getStudentAchievements(req.user.id))
));

const getLearningReport = asyncHandler(async (req, res) => (
  sendSuccess(res, 200, await learningReportService.getLearningReport(req.user.id))
));

module.exports = { getMyProgress, getSubjectsProgress, getRecommendations, getAchievements, getLearningReport };
