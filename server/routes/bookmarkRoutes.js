const express = require('express');
const { createAuthenticate } = require('../middleware/authenticate');
const { authorizeRole } = require('../middleware/authorizeRole');
const controller = require('../controllers/bookmarkController');

function createBookmarkRoutes(config) {
  const router = express.Router();
  router.use(createAuthenticate(config), authorizeRole('student'));
  router.get('/', controller.listBookmarks);
  router.get('/:lessonId', controller.getBookmarkStatus);
  router.put('/:lessonId', controller.addBookmark);
  router.delete('/:lessonId', controller.removeBookmark);
  return router;
}

module.exports = { createBookmarkRoutes };
