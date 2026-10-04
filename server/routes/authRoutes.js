const express = require('express');
const { z } = require('zod');
const { createAuthController } = require('../controllers/authController');
const { createAuthenticate } = require('../middleware/authenticate');
const { validateBody } = require('../utils/validation');
const { passwordByteLength } = require('../utils/password');

const emailSchema = z.string({ error: 'Email is required.' })
  .trim()
  .email('Enter a valid email address.')
  .max(254, 'Email address must be 254 characters or fewer.')
  .transform((email) => email.toLowerCase());
const passwordSchema = z.string({ error: 'Password is required.' }).min(1, 'Password is required.');

const registerSchema = z.object({
  name: z.string({ error: 'Name is required.' })
    .trim()
    .min(2, 'Name must contain at least 2 characters.')
    .max(80, 'Name must be 80 characters or fewer.'),
  email: emailSchema,
  password: z.string()
    .min(8, 'Password must be at least 8 characters.')
    .refine((password) => passwordByteLength(password) <= 72, 'Password must be 72 UTF-8 bytes or fewer.'),
}).strict();

const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema.refine((password) => passwordByteLength(password) <= 72, 'Invalid email or password.'),
}).strict();

function createAuthRoutes(config) {
  const router = express.Router();
  const controller = createAuthController(config);
  const authenticate = createAuthenticate(config);

  router.post('/register', validateBody(registerSchema), controller.register);
  router.post('/login', validateBody(loginSchema), controller.login);
  router.get('/me', authenticate, controller.me);
  return router;
}

module.exports = { createAuthRoutes };
