// This is the retained entry point for the previously applied one-time
// zero-based normalization. It is intentionally read-only now so rerunning an
// old command can never convert the standardized 1–4 data back to 0–3.
async function main() {
  const mongoose = require('mongoose');
  const { getConfig } = require('../config/env');
  await mongoose.connect(getConfig().mongoUri, { autoIndex: false });
  try {
    const marker = await mongoose.connection.db.collection('readsmartmigrations')
      .findOne({ _id: 'question-correct-answer-zero-based-v1' });
    if (!marker) {
      throw new Error('This legacy migration is retired. Use the one-based migration command after verifying the database state.');
    }
    console.log('The legacy zero-based migration was previously recorded; no data was changed.');
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Legacy assessment index migration not run: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { main };
