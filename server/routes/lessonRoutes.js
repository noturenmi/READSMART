const express = require('express');
const { createAuthenticate } = require('../middleware/authenticate');
const controller = require('../controllers/lessonController');
const assessmentController = require('../controllers/assessmentController');
const writingController = require('../controllers/writingController');
const { authorizeRole } = require('../middleware/authorizeRole');
const { createAIController } = require('../controllers/aiController');

function createLessonRoutes(config) {
  const router = express.Router();
  router.use(createAuthenticate(config));
  const aiController = createAIController(config);
  router.get('/:lessonId/questions', assessmentController.getQuestions);
  router.post('/:lessonId/assessment', authorizeRole('student'), assessmentController.validateAssessmentBody, assessmentController.submitAssessment);
  router.get('/:lessonId/assessment-attempts/:attemptId/review', authorizeRole('student'), assessmentController.getAssessmentReview);
  router.get('/:lessonId/assessment-attempts', assessmentController.getAttempts);
  router.get('/:lessonId/writing', writingController.getActivity);
  router.post('/:lessonId/writing', authorizeRole('student'), writingController.validateSubmission, writingController.submitActivity);
  router.get('/:lessonId/writing-submissions', authorizeRole('student'), writingController.getSubmissions);
  router.post('/:lessonId/summary', aiController.validateEmptyBody, aiController.getSummary);
  router.post('/:lessonId/writing/:submissionId/ai-feedback', authorizeRole('student'), aiController.validateEmptyBody, aiController.getWritingFeedback);
  router.get('/:lessonId', controller.getLesson);
  return router;
}

module.exports = { createLessonRoutes };
