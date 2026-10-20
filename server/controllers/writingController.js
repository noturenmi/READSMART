const mongoose = require('mongoose');
const { z } = require('zod');
const { AppError } = require('../utils/AppError');
const { asyncHandler } = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const { validateBody } = require('../utils/validation');
const writingService = require('../services/writingService');

const objectId = /^[a-f\d]{24}$/i;

function validateLessonId(lessonId) {
  if (!objectId.test(lessonId) || !mongoose.Types.ObjectId.isValid(lessonId)) {
    throw new AppError('Enter a valid lesson ID.', 400, 'INVALID_LESSON_ID');
  }
}

const writingSubmissionSchema = z.object({
  writingActivityId: z.string().regex(objectId, 'Enter a valid writing activity ID.'),
  response: z.string().trim()
    .min(1, 'Write a response before submitting.')
    .max(15000, 'Your response must be 15,000 characters or fewer.'),
  requestKey: z.string().min(16).max(100).regex(/^[a-zA-Z0-9_-]+$/).optional(),
}).strict();

const validateSubmission = validateBody(writingSubmissionSchema);

const listActivities = asyncHandler(async (req, res) => (
  sendSuccess(res, 200, await writingService.listWritingActivities(req.user.id))
));

const getActivity = asyncHandler(async (req, res) => {
  validateLessonId(req.params.lessonId);
  return sendSuccess(res, 200, await writingService.getLessonWritingActivity(req.params.lessonId));
});

const submitActivity = asyncHandler(async (req, res) => {
  validateLessonId(req.params.lessonId);
  return sendSuccess(res, 201, await writingService.submitLessonWriting(
    req.user.id,
    req.params.lessonId,
    req.validatedBody.writingActivityId,
    req.validatedBody.response,
    req.validatedBody.requestKey,
  ));
});

const getSubmissions = asyncHandler(async (req, res) => {
  validateLessonId(req.params.lessonId);
  return sendSuccess(res, 200, await writingService.getLessonWritingSubmissions(req.user.id, req.params.lessonId));
});

function getPagination(req) {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new AppError('Use a page of 1 or more and a limit from 1 to 50.', 400, 'INVALID_PAGINATION');
  }
  return { page, limit };
}

const getHistory = asyncHandler(async (req, res) => (
  sendSuccess(res, 200, await writingService.getWritingSubmissionHistory(req.user.id, getPagination(req)))
));

const getHistoryEntry = asyncHandler(async (req, res) => {
  if (!objectId.test(req.params.submissionId) || !mongoose.Types.ObjectId.isValid(req.params.submissionId)) {
    throw new AppError('Enter a valid writing submission ID.', 400, 'INVALID_WRITING_SUBMISSION_ID');
  }
  return sendSuccess(res, 200, await writingService.getWritingSubmissionDetail(req.user.id, req.params.submissionId));
});

module.exports = {
  getHistory,
  getHistoryEntry,
  getActivity,
  getSubmissions,
  listActivities,
  submitActivity,
  validateSubmission,
};
