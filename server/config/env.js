const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

function getConfig() {
  const port = Number(process.env.PORT || 3000);
  const jwtSecret = process.env.JWT_SECRET || '';

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required. Copy server/.env.example to server/.env and configure it.');
  }
  if (jwtSecret.length < 32 || jwtSecret.startsWith('replace-with-')) {
    throw new Error('JWT_SECRET must be a private random value with at least 32 characters.');
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid TCP port.');
  }

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port,
    mongoUri: process.env.MONGODB_URI,
    jwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
    corsOrigins: (process.env.CORS_ORIGINS || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    ai: {
      provider: process.env.AI_PROVIDER || '',
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL || '',
      model: process.env.OLLAMA_MODEL || '',
      numCtx: Number(process.env.OLLAMA_NUM_CTX || 4096),
      timeoutMs: Number(process.env.AI_TIMEOUT_MS || 90000),
    },
  };
}

module.exports = { getConfig };
