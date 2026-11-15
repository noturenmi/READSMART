const mongoose = require('mongoose');
const { AppError } = require('../utils/AppError');
const { asyncHandler } = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const bookmarkService = require('../services/bookmarkService');

function validateObjectId(value, label, code) {
  if (!/^[a-f\d]{24}$/i.test(value) || !mongoose.Types.ObjectId.isValid(value)) {
    throw new AppError(`Enter a valid ${label} ID.`, 400, code);
  }
}

function validateLessonId(req) {
  validateObjectId(req.params.lessonId, 'lesson', 'INVALID_LESSON_ID');
}

const listBookmarks = asyncHandler(async (req, res) => {
  const { subjectId } = req.query;
  if (subjectId !== undefined) validateObjectId(subjectId, 'subject', 'INVALID_SUBJECT_ID');
  const result = await bookmarkService.listBookmarks(req.user.id, subjectId);
  return sendSuccess(res, 200, result);
});

const getBookmarkStatus = asyncHandler(async (req, res) => {
  validateLessonId(req);
  const result = await bookmarkService.getBookmarkStatus(req.user.id, req.params.lessonId);
  return sendSuccess(res, 200, result);
});

const addBookmark = asyncHandler(async (req, res) => {
  validateLessonId(req);
  const result = await bookmarkService.addBookmark(req.user.id, req.params.lessonId);
  return sendSuccess(res, 200, result);
});

const removeBookmark = asyncHandler(async (req, res) => {
  validateLessonId(req);
  const result = await bookmarkService.removeBookmark(req.user.id, req.params.lessonId);
  return sendSuccess(res, 200, result);
});

module.exports = { addBookmark, getBookmarkStatus, listBookmarks, removeBookmark };
