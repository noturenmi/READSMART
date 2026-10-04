const express = require('express');
const { createAuthenticate } = require('../middleware/authenticate');
const { authorizeRole } = require('../middleware/authorizeRole');
const controller = require('../controllers/adminController');

function createAdminRoutes(config) {
  const router = express.Router();
  router.use(createAuthenticate(config), authorizeRole('admin'));

  router.get('/dashboard', controller.dashboard);

  router.get('/users', controller.listUsers);
  router.get('/users/:userId', controller.getUser);
  router.get('/users/:userId/progress', controller.getUserProgress);

  router.get('/subjects', controller.listSubjects);
  router.post('/subjects', controller.createSubjectValidator, controller.createSubject);
  router.put('/subjects/:subjectId', controller.updateSubjectValidator, controller.updateSubject);
  router.patch('/subjects/:subjectId/publish', controller.subjectPublishValidator, controller.publishSubject);

  router.get('/subjects/:subjectId/lessons', controller.listLessons);
  router.post('/subjects/:subjectId/lessons', controller.createLessonValidator, controller.createLesson);
  router.put('/lessons/:lessonId', controller.updateLessonValidator, controller.updateLesson);
  router.patch('/lessons/:lessonId/publish', controller.publishValidator, controller.publishLesson);

  router.get('/lessons/:lessonId/questions', controller.listQuestions);
  router.post('/lessons/:lessonId/questions', controller.createQuestionValidator, controller.createQuestion);
  router.put('/questions/:questionId', controller.updateQuestionValidator, controller.updateQuestion);
  router.patch('/questions/:questionId/publish', controller.publishValidator, controller.publishQuestion);

  router.get('/lessons/:lessonId/writing', controller.getWritingActivity);
  router.post('/lessons/:lessonId/writing', controller.createWritingValidator, controller.createWritingActivity);
  router.put('/writing/:activityId', controller.updateWritingValidator, controller.updateWritingActivity);
  router.patch('/writing/:activityId/publish', controller.publishValidator, controller.publishWritingActivity);

  return router;
}

module.exports = { createAdminRoutes };
