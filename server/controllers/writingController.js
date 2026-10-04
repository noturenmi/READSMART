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
  ));
});

const getSubmissions = asyncHandler(async (req, res) => {
  validateLessonId(req.params.lessonId);
  return sendSuccess(res, 200, await writingService.getLessonWritingSubmissions(req.user.id, req.params.lessonId));
});

module.exports = {
  getActivity,
  getSubmissions,
  listActivities,
  submitActivity,
  validateSubmission,
};
