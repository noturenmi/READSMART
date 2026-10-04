const mongoose = require('mongoose');
const { z } = require('zod');
const { AppError } = require('../utils/AppError');
const { asyncHandler } = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const assessmentService = require('../services/assessmentService');
const { validateBody } = require('../utils/validation');

const objectId = /^[a-f\d]{24}$/i;

function validateLessonId(lessonId) {
  if (!objectId.test(lessonId) || !mongoose.Types.ObjectId.isValid(lessonId)) {
    throw new AppError('Enter a valid lesson ID.', 400, 'INVALID_LESSON_ID');
  }
}

const submitSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string().regex(objectId, 'Enter a valid question ID.'),
    selectedAnswer: z.number().int().min(0).max(3),
  }).strict()).min(1).max(100),
}).strict();

const validateAssessmentBody = validateBody(submitSchema);

const getQuestions = asyncHandler(async (req, res) => {
  validateLessonId(req.params.lessonId);
  return sendSuccess(res, 200, await assessmentService.getLessonQuestions(req.params.lessonId));
});

const submitAssessment = asyncHandler(async (req, res) => {
  validateLessonId(req.params.lessonId);
  return sendSuccess(res, 201, await assessmentService.submitLessonAssessment(
    req.user.id,
    req.params.lessonId,
    req.validatedBody.answers,
  ));
});

const getAttempts = asyncHandler(async (req, res) => {
  validateLessonId(req.params.lessonId);
  return sendSuccess(res, 200, await assessmentService.getAssessmentAttempts(req.user.id, req.params.lessonId));
});

module.exports = { getAttempts, getQuestions, submitAssessment, validateAssessmentBody };
