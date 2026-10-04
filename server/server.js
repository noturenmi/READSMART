const { getConfig } = require('./config/env');
const { connectDatabase } = require('./config/database');
const { createApp } = require('./app');

async function startServer(config = getConfig()) {
  await connectDatabase(config.mongoUri);

  const app = createApp(config);
  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(config.port);
    listener.once('listening', () => resolve(listener));
    listener.once('error', reject);
  });
  console.log(`READSMART API listening on port ${server.address().port}`);

  if (require.main === module) {
    async function shutdown(signal) {
      console.log(`${signal} received; closing READSMART API.`);
      server.close(async () => {
        const mongoose = require('mongoose');
        await mongoose.disconnect();
        process.exit(0);
      });
    }

    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
  }

  return server;
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error(`READSMART API could not start: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { startServer };
