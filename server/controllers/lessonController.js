const mongoose = require('mongoose');
const { AppError } = require('../utils/AppError');
const { asyncHandler } = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const readingService = require('../services/readingService');

const getLesson = asyncHandler(async (req, res) => {
  const { lessonId } = req.params;
  if (!/^[a-f\d]{24}$/i.test(lessonId) || !mongoose.Types.ObjectId.isValid(lessonId)) {
    throw new AppError('Enter a valid lesson ID.', 400, 'INVALID_LESSON_ID');
  }
  const lesson = await readingService.getPublishedLesson(lessonId);
  if (!lesson) throw new AppError('This lesson is not available.', 404, 'LESSON_NOT_FOUND');
  return sendSuccess(res, 200, { lesson });
});

module.exports = { getLesson };
