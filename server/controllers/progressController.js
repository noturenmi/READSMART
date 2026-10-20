const { asyncHandler } = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const progressService = require('../services/progressService');
const recommendationService = require('../services/recommendationService');

const getMyProgress = asyncHandler(async (req, res) => (
  sendSuccess(res, 200, await progressService.getStudentProgress(req.user.id))
));

const getSubjectsProgress = asyncHandler(async (req, res) => (
  sendSuccess(res, 200, { subjects: await progressService.getSubjectProgress(req.user.id) })
));

const getRecommendations = asyncHandler(async (req, res) => (
  sendSuccess(res, 200, await recommendationService.getRecommendedLessons(req.user.id))
));

module.exports = { getMyProgress, getSubjectsProgress, getRecommendations };
