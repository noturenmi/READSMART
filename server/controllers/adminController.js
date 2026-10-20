const mongoose = require('mongoose');
const { z } = require('zod');
const { AppError } = require('../utils/AppError');
const { asyncHandler } = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const { validateBody } = require('../utils/validation');
const adminService = require('../services/adminService');
const { rubricCriteria } = require('../utils/writingRubric');

const idPattern = /^[a-f\d]{24}$/i;
const questionTypes = ['key_idea', 'vocabulary', 'inference', 'interpretation', 'evaluation'];
const criterionKeys = rubricCriteria.map(({ key }) => key);

function validateId(value, label) {
  if (!idPattern.test(value || '') || !mongoose.Types.ObjectId.isValid(value)) {
    throw new AppError(`Enter a valid ${label} ID.`, 400, `INVALID_${label.toUpperCase()}_ID`);
  }
}

const subjectFields = {
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().toUpperCase().regex(/^[A-Z]{2,8}$/),
  description: z.string().trim().max(500),
  order: z.number().int().min(0),
  isActive: z.boolean(),
};
const createSubjectValidator = validateBody(z.object({
  ...subjectFields,
  description: subjectFields.description.default(''),
  isActive: subjectFields.isActive.default(true),
}).strict());
const updateSubjectValidator = validateBody(z.object(subjectFields).partial().strict());
const publishValidator = validateBody(z.object({ isPublished: z.boolean() }).strict());
const subjectPublishValidator = validateBody(z.object({ isActive: z.boolean() }).strict());

const lessonFields = {
  title: z.string().trim().min(2).max(180),
  lessonNumber: z.number().int().min(1),
  overview: z.string().trim().max(1000),
  lesson: z.string().trim().min(10).max(50000),
  discussion: z.string().trim().max(50000),
  example: z.string().trim().max(20000),
  keyConcepts: z.array(z.string().trim().min(1).max(300)).max(100),
  keyTakeaway: z.string().trim().max(5000),
  contentStatus: z.enum(['pending', 'ready']),
  isPublished: z.boolean(),
};
const createLessonValidator = validateBody(z.object({
  ...lessonFields,
  overview: lessonFields.overview.default(''),
  discussion: lessonFields.discussion.default(''),
  example: lessonFields.example.default(''),
  keyConcepts: lessonFields.keyConcepts.default([]),
  keyTakeaway: lessonFields.keyTakeaway.default(''),
  contentStatus: lessonFields.contentStatus.default('ready'),
  isPublished: lessonFields.isPublished.default(false),
}).strict());
const updateLessonValidator = validateBody(z.object(lessonFields).partial().strict());

const questionFields = {
  question: z.string().trim().min(10).max(1200),
  questionType: z.enum(questionTypes),
  choices: z.array(z.string().trim().min(1).max(500)).length(4)
    .refine((choices) => new Set(choices).size === 4, 'Choices must be unique.'),
  correctAnswer: z.number().int().min(0).max(3),
  explanation: z.string().trim().min(10).max(1000),
  points: z.number().int().min(1).max(100),
  order: z.number().int().min(1),
  isPublished: z.boolean(),
};
const createQuestionValidator = validateBody(z.object({
  ...questionFields,
  points: questionFields.points.default(1),
  isPublished: questionFields.isPublished.default(false),
}).strict());
const updateQuestionValidator = validateBody(z.object(questionFields).partial().strict());

const criterionSchema = z.object({
  key: z.enum(criterionKeys),
  label: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(400),
  maximumScore: z.literal(5),
}).strict();
const criteriaSchema = z.array(criterionSchema).length(5)
  .refine((criteria) => new Set(criteria.map(({ key }) => key)).size === criterionKeys.length, 'Include each rubric criterion exactly once.');
const writingFields = {
  title: z.string().trim().min(3).max(160),
  prompt: z.string().trim().min(10).max(2000),
  instructions: z.string().trim().min(10).max(1200),
  minimumWords: z.number().int().min(1).max(5000),
  maximumWords: z.number().int().min(1).max(10000),
  criteria: criteriaSchema.optional(),
  isPublished: z.boolean(),
};
const createWritingValidator = validateBody(z.object({
  ...writingFields,
  isPublished: writingFields.isPublished.default(false),
}).strict().refine((body) => body.maximumWords >= body.minimumWords, {
  path: ['maximumWords'], message: 'Maximum words must be at least minimum words.',
}));
const updateWritingValidator = validateBody(z.object(writingFields).partial().strict());

const dashboard = asyncHandler(async (_req, res) => sendSuccess(res, 200, await adminService.getDashboard()));

const listUsers = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new AppError('Use a page of 1 or more and a limit from 1 to 50.', 400, 'INVALID_PAGINATION');
  }
  return sendSuccess(res, 200, await adminService.listStudents({ page, limit }));
});

const getUser = asyncHandler(async (req, res) => {
  validateId(req.params.userId, 'user');
  return sendSuccess(res, 200, { user: await adminService.getStudent(req.params.userId) });
});

const getUserProgress = asyncHandler(async (req, res) => {
  validateId(req.params.userId, 'user');
  return sendSuccess(res, 200, await adminService.getStudentProgress(req.params.userId));
});

const getUserWritingSubmissionHistory = asyncHandler(async (req, res) => {
  validateId(req.params.userId, 'user');
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new AppError('Use a page of 1 or more and a limit from 1 to 50.', 400, 'INVALID_PAGINATION');
  }
  return sendSuccess(res, 200, await adminService.getStudentWritingSubmissionHistory(
    req.params.userId,
    { page, limit },
  ));
});

const getUserWritingSubmission = asyncHandler(async (req, res) => {
  validateId(req.params.userId, 'user');
  validateId(req.params.submissionId, 'writing submission');
  return sendSuccess(res, 200, await adminService.getStudentWritingSubmission(
    req.params.userId,
    req.params.submissionId,
  ));
});

const listSubjects = asyncHandler(async (_req, res) => sendSuccess(res, 200, { subjects: await adminService.listSubjects() }));
const createSubject = asyncHandler(async (req, res) => sendSuccess(res, 201, { subject: await adminService.createSubject(req.validatedBody) }));
const updateSubject = asyncHandler(async (req, res) => {
  validateId(req.params.subjectId, 'subject');
  return sendSuccess(res, 200, { subject: await adminService.updateSubject(req.params.subjectId, req.validatedBody) });
});
const publishSubject = asyncHandler(async (req, res) => {
  validateId(req.params.subjectId, 'subject');
  return sendSuccess(res, 200, { subject: await adminService.setSubjectActive(req.params.subjectId, req.validatedBody.isActive) });
});

const listLessons = asyncHandler(async (req, res) => {
  validateId(req.params.subjectId, 'subject');
  return sendSuccess(res, 200, await adminService.listLessons(req.params.subjectId));
});
const createLesson = asyncHandler(async (req, res) => {
  validateId(req.params.subjectId, 'subject');
  return sendSuccess(res, 201, { lesson: await adminService.createLesson(req.params.subjectId, req.validatedBody) });
});
const updateLesson = asyncHandler(async (req, res) => {
  validateId(req.params.lessonId, 'lesson');
  return sendSuccess(res, 200, { lesson: await adminService.updateLesson(req.params.lessonId, req.validatedBody) });
});
const publishLesson = asyncHandler(async (req, res) => {
  validateId(req.params.lessonId, 'lesson');
  return sendSuccess(res, 200, { lesson: await adminService.setLessonPublished(req.params.lessonId, req.validatedBody.isPublished) });
});

const listQuestions = asyncHandler(async (req, res) => {
  validateId(req.params.lessonId, 'lesson');
  return sendSuccess(res, 200, await adminService.listQuestions(req.params.lessonId));
});
const createQuestion = asyncHandler(async (req, res) => {
  validateId(req.params.lessonId, 'lesson');
  return sendSuccess(res, 201, { question: await adminService.createQuestion(req.params.lessonId, req.validatedBody) });
});
const updateQuestion = asyncHandler(async (req, res) => {
  validateId(req.params.questionId, 'question');
  return sendSuccess(res, 200, { question: await adminService.updateQuestion(req.params.questionId, req.validatedBody) });
});
const publishQuestion = asyncHandler(async (req, res) => {
  validateId(req.params.questionId, 'question');
  return sendSuccess(res, 200, { question: await adminService.setQuestionPublished(req.params.questionId, req.validatedBody.isPublished) });
});

const getWritingActivity = asyncHandler(async (req, res) => {
  validateId(req.params.lessonId, 'lesson');
  return sendSuccess(res, 200, await adminService.getWritingActivity(req.params.lessonId));
});
const createWritingActivity = asyncHandler(async (req, res) => {
  validateId(req.params.lessonId, 'lesson');
  return sendSuccess(res, 201, { activity: await adminService.createWritingActivity(req.params.lessonId, req.validatedBody) });
});
const updateWritingActivity = asyncHandler(async (req, res) => {
  validateId(req.params.activityId, 'writing activity');
  return sendSuccess(res, 200, { activity: await adminService.updateWritingActivity(req.params.activityId, req.validatedBody) });
});
const publishWritingActivity = asyncHandler(async (req, res) => {
  validateId(req.params.activityId, 'writing activity');
  return sendSuccess(res, 200, { activity: await adminService.setWritingActivityPublished(req.params.activityId, req.validatedBody.isPublished) });
});

module.exports = {
  createLessonValidator,
  createQuestionValidator,
  createSubjectValidator,
  createWritingValidator,
  dashboard,
  getUser,
  getUserProgress,
  getUserWritingSubmission,
  getUserWritingSubmissionHistory,
  getWritingActivity,
  listLessons,
  listQuestions,
  listSubjects,
  listUsers,
  publishValidator,
  publishLesson,
  publishQuestion,
  publishSubject,
  publishWritingActivity,
  updateLesson,
  updateLessonValidator,
  updateQuestion,
  updateQuestionValidator,
  updateSubject,
  updateSubjectValidator,
  updateWritingActivity,
  updateWritingValidator,
  subjectPublishValidator,
  createLesson,
  createQuestion,
  createSubject,
  createWritingActivity,
};
