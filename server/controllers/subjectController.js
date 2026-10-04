const mongoose = require('mongoose');
const { AppError } = require('../utils/AppError');
const { asyncHandler } = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const readingService = require('../services/readingService');

function validateSubjectId(subjectId) {
  if (!/^[a-f\d]{24}$/i.test(subjectId) || !mongoose.Types.ObjectId.isValid(subjectId)) {
    throw new AppError('Enter a valid subject ID.', 400, 'INVALID_SUBJECT_ID');
  }
}

const listSubjects = asyncHandler(async (_req, res) => {
  const subjects = await readingService.listSubjects();
  return sendSuccess(res, 200, { subjects });
});

const getSubject = asyncHandler(async (req, res) => {
  validateSubjectId(req.params.subjectId);
  const subject = await readingService.getSubject(req.params.subjectId);
  if (!subject) throw new AppError('This subject is not available.', 404, 'SUBJECT_NOT_FOUND');
  return sendSuccess(res, 200, { subject });
});

const listSubjectLessons = asyncHandler(async (req, res) => {
  validateSubjectId(req.params.subjectId);
  const result = await readingService.listPublishedLessons(req.params.subjectId);
  if (!result) throw new AppError('This subject is not available.', 404, 'SUBJECT_NOT_FOUND');
  return sendSuccess(res, 200, result);
});

module.exports = { getSubject, listSubjectLessons, listSubjects };
