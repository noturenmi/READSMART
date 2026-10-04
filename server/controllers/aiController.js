const mongoose = require('mongoose');
const { z } = require('zod');
const { AppError } = require('../utils/AppError');
const { asyncHandler } = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const { validateBody } = require('../utils/validation');
const { createAIService } = require('../services/aiService');
const lessonSummaryService = require('../services/lessonSummaryService');
const aiFeedbackService = require('../services/aiFeedbackService');

const objectId = /^[a-f\d]{24}$/i;
const emptyBodySchema = z.object({}).strict().optional().default({});
const validateEmptyBody = validateBody(emptyBodySchema);

function validateObjectId(value, label) {
  if (!objectId.test(value) || !mongoose.Types.ObjectId.isValid(value)) {
    throw new AppError(`Enter a valid ${label} ID.`, 400, `INVALID_${label.toUpperCase()}_ID`);
  }
}

function createAIController(config) {
  const aiService = createAIService(config);

  const getSummary = asyncHandler(async (req, res) => {
    validateObjectId(req.params.lessonId, 'lesson');
    const result = await lessonSummaryService.generateLessonSummary(req.params.lessonId, aiService);
    return sendSuccess(res, 200, result);
  });

  const getWritingFeedback = asyncHandler(async (req, res) => {
    validateObjectId(req.params.lessonId, 'lesson');
    validateObjectId(req.params.submissionId, 'submission');
    const result = await aiFeedbackService.generateWritingFeedback(
      req.user.id,
      req.params.lessonId,
      req.params.submissionId,
      aiService,
    );
    return sendSuccess(res, 200, result);
  });

  return {
    getSummary,
    getWritingFeedback,
    validateEmptyBody,
  };
}

module.exports = { createAIController };
