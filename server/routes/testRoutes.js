const express = require('express');
const { createAuthenticate } = require('../middleware/authenticate');
const { authorizeRole } = require('../middleware/authorizeRole');
const { sendSuccess } = require('../utils/apiResponse');

function createTestRoutes(config) {
  const router = express.Router();
  const authenticate = createAuthenticate(config);

  router.get('/protected', authenticate, (req, res) => {
    return sendSuccess(res, 200, {
      message: 'You are authenticated.',
      userId: req.user.id,
      role: req.user.role,
    });
  });

  return router;
}

function createAdminTestRoutes(config) {
  const router = express.Router();
  const authenticate = createAuthenticate(config);

  router.get('/test', authenticate, authorizeRole('admin'), (_req, res) => {
    return sendSuccess(res, 200, { message: 'Administrator authorization succeeded.' });
  });
  return router;
}

module.exports = { createTestRoutes, createAdminTestRoutes };
