const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createAuthRoutes } = require('./routes/authRoutes');
const { createAdminTestRoutes, createTestRoutes } = require('./routes/testRoutes');
const { createSubjectRoutes } = require('./routes/subjectRoutes');
const { createLessonRoutes } = require('./routes/lessonRoutes');
const { createWritingRoutes } = require('./routes/writingRoutes');
const { createProgressRoutes } = require('./routes/progressRoutes');
const { createAdminRoutes } = require('./routes/adminRoutes');
const { errorHandler, notFound } = require('./middleware/errorHandler');

function createApp(config) {
  const app = express();
  const corsOptions = config.corsOrigins.length
    ? { origin: config.corsOrigins }
    : { origin: false };

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '32kb' }));

  app.use('/api/auth', createAuthRoutes(config));
  app.use('/api/test', createTestRoutes(config));
  app.use('/api/admin', createAdminTestRoutes(config));
  app.use('/api/subjects', createSubjectRoutes(config));
  app.use('/api/lessons', createLessonRoutes(config));
  app.use('/api/writing', createWritingRoutes(config));
  app.use('/api/progress', createProgressRoutes(config));
  app.use('/api/admin', createAdminRoutes(config));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
