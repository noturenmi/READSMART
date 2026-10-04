const express = require('express');
const { createAuthenticate } = require('../middleware/authenticate');
const controller = require('../controllers/subjectController');

function createSubjectRoutes(config) {
  const router = express.Router();
  const authenticate = createAuthenticate(config);
  router.use(authenticate);
  router.get('/', controller.listSubjects);
  router.get('/:subjectId', controller.getSubject);
  router.get('/:subjectId/lessons', controller.listSubjectLessons);
  return router;
}

module.exports = { createSubjectRoutes };
