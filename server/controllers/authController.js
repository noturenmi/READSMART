const { sendSuccess } = require('../utils/apiResponse');
const { asyncHandler } = require('../utils/asyncHandler');
const authService = require('../services/authService');

function createAuthController(config) {
  return {
    register: asyncHandler(async (req, res) => {
      const result = await authService.registerStudent(req.validatedBody, config);
      return sendSuccess(res, 201, result);
    }),

    login: asyncHandler(async (req, res) => {
      const result = await authService.login(req.validatedBody, config);
      return sendSuccess(res, 200, result);
    }),

    me: asyncHandler(async (req, res) => {
      return sendSuccess(res, 200, { user: authService.publicUser(req.user) });
    }),
  };
}

module.exports = { createAuthController };
