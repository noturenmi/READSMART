const express = require('express');
const { createAuthenticate } = require('../middleware/authenticate');
const { authorizeRole } = require('../middleware/authorizeRole');
const controller = require('../controllers/notificationController');

function createNotificationRoutes(config) {
  const router = express.Router();
  router.use(createAuthenticate(config), authorizeRole('student'));
  router.get('/', controller.pagination, controller.list);
  router.get('/unread-count', controller.unreadCount);
  router.patch('/read-all', controller.markAllRead);
  router.patch('/:notificationId/read', controller.validateNotificationId, controller.markRead);
  return router;
}

module.exports = { createNotificationRoutes };
