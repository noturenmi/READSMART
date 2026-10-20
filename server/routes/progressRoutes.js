const express = require('express');
const { createAuthenticate } = require('../middleware/authenticate');
const { authorizeRole } = require('../middleware/authorizeRole');
const controller = require('../controllers/progressController');

function createProgressRoutes(config) {
  const router = express.Router();
  router.use(createAuthenticate(config));
  router.use(authorizeRole('student'));
  router.get('/me', controller.getMyProgress);
  router.get('/subjects', controller.getSubjectsProgress);
  router.get('/recommendations', controller.getRecommendations);
  return router;
}

module.exports = { createProgressRoutes };
