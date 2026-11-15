const express = require('express');
const { createAuthenticate } = require('../middleware/authenticate');
const { authorizeRole } = require('../middleware/authorizeRole');
const controller = require('../controllers/dailyGoalController');

function createDailyGoalRoutes(config) {
  const router = express.Router();
  router.use(createAuthenticate(config), authorizeRole('student'));
  router.get('/today', controller.getToday);
  router.put('/today', controller.validateTargets, controller.updateToday);
  router.get('/history', controller.validatePagination, controller.getHistory);
  return router;
}

module.exports = { createDailyGoalRoutes };
