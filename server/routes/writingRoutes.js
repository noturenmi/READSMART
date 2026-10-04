const express = require('express');
const { createAuthenticate } = require('../middleware/authenticate');
const { authorizeRole } = require('../middleware/authorizeRole');
const controller = require('../controllers/writingController');

function createWritingRoutes(config) {
  const router = express.Router();
  router.use(createAuthenticate(config), authorizeRole('student'));
  router.get('/activities', controller.listActivities);
  return router;
}

module.exports = { createWritingRoutes };
