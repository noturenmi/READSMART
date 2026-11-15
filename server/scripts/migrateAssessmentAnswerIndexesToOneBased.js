const crypto = require('node:crypto');

const MIGRATION_ID = 'assessment-answer-index-one-based-v1';
const PREVIOUS_MIGRATION_ID = 'question-correct-answer-zero-based-v1';
const BACKUP_COLLECTION = 'readsmartmigrationbackups';

function key(value) {
  return value && typeof value.toHexString === 'function' ? value.toHexString() : String(value);
}

function stableValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value.toHexString === 'function') return value.toHexString();
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((name) => [name, stableValue(value[name])]));
  }
  return value;
}

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex');
}

function requireIndex(value, min, max, label) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be an integer from ${min} through ${max}; migration stopped before writing.`);
  }
}

function inspectLegacyRecords(questions, attempts) {
  if (questions.length === 0) throw new Error('No assessment questions were found; migration stopped.');
  const questionById = new Map();
  for (const question of questions) {
    requireIndex(question.correctAnswer, 0, 3, `Question ${key(question._id)} correctAnswer`);
    if (!Array.isArray(question.choices) || question.choices.length !== 4) {
      throw new Error(`Question ${key(question._id)} does not have four choices; migration stopped before writing.`);
    }
    questionById.set(key(question._id), question);
  }

  let answerCount = 0;
  let selectedAnswerCount = 0;
  let correctAnswerSnapshotCount = 0;
  for (const attempt of attempts) {
    if (!Array.isArray(attempt.answers)) throw new Error(`Attempt ${key(attempt._id)} has malformed answers; migration stopped.`);
    answerCount += attempt.answers.length;
    for (const [index, answer] of attempt.answers.entries()) {
      requireIndex(answer.selectedAnswer, 0, 3, `Attempt ${key(attempt._id)} answer ${index + 1} selectedAnswer`);
      selectedAnswerCount += 1;
      if (Object.hasOwn(answer, 'correctAnswer')) {
        requireIndex(answer.correctAnswer, 0, 3, `Attempt ${key(attempt._id)} answer ${index + 1} correctAnswer snapshot`);
        correctAnswerSnapshotCount += 1;
      }
      if (Object.hasOwn(answer, 'choices') && (!Array.isArray(answer.choices) || answer.choices.length !== 4)) {
        throw new Error(`Attempt ${key(attempt._id)} answer ${index + 1} has an incomplete choice snapshot; migration stopped.`);
      }
      const sourceQuestion = questionById.get(key(answer.questionId));
      if (!sourceQuestion && !Array.isArray(answer.choices)) {
        throw new Error(`Attempt ${key(attempt._id)} answer ${index + 1} has no question or choice snapshot; migration stopped.`);
      }
    }
  }
  return { answerCount, selectedAnswerCount, correctAnswerSnapshotCount };
}

async function readLegacyData(db, session) {
  const options = session ? { session } : {};
  let previousMigration;
  let migration;
  let questions;
  let attempts;
  if (session) {
    previousMigration = await db.collection('readsmartmigrations').findOne({ _id: PREVIOUS_MIGRATION_ID }, options);
    migration = await db.collection('readsmartmigrations').findOne({ _id: MIGRATION_ID }, options);
    questions = await db.collection('readingquestions').find({}, { ...options, projection: { _id: 1, choices: 1, correctAnswer: 1 } }).toArray();
    attempts = await db.collection('assessmentattempts').find({}, options).toArray();
  } else {
    [previousMigration, migration, questions, attempts] = await Promise.all([
      db.collection('readsmartmigrations').findOne({ _id: PREVIOUS_MIGRATION_ID }, options),
      db.collection('readsmartmigrations').findOne({ _id: MIGRATION_ID }, options),
      db.collection('readingquestions').find({}, { ...options, projection: { _id: 1, choices: 1, correctAnswer: 1 } }).toArray(),
      db.collection('assessmentattempts').find({}, options).toArray(),
    ]);
  }
  if (!previousMigration) throw new Error('The recorded zero-based migration marker is missing; current index format cannot be verified safely.');
  if (migration) return { migration, questions, attempts, counts: migration.counts };
  const counts = inspectLegacyRecords(questions, attempts);
  return { migration, questions, attempts, counts };
}

function makeAttemptAfter(attempt) {
  return {
    ...attempt,
    answers: attempt.answers.map((answer) => ({
      ...answer,
      selectedAnswer: answer.selectedAnswer + 1,
      ...(Object.hasOwn(answer, 'correctAnswer') ? { correctAnswer: answer.correctAnswer + 1 } : {}),
    })),
  };
}

function verifyMeaningPreserved(beforeQuestions, afterQuestions, beforeAttempts, afterAttempts) {
  const afterQuestionById = new Map(afterQuestions.map((question) => [key(question._id), question]));
  for (const before of beforeQuestions) {
    const after = afterQuestionById.get(key(before._id));
    if (!after || before.choices[before.correctAnswer] !== after.choices[after.correctAnswer - 1]) {
      throw new Error(`Question ${key(before._id)} correct choice changed during index conversion.`);
    }
  }
  const afterAttemptById = new Map(afterAttempts.map((attempt) => [key(attempt._id), attempt]));
  for (const before of beforeAttempts) {
    const after = afterAttemptById.get(key(before._id));
    if (!after || before.answers.length !== after.answers.length) throw new Error(`Attempt ${key(before._id)} changed during index conversion.`);
    for (const [index, beforeAnswer] of before.answers.entries()) {
      const afterAnswer = after.answers[index];
      const choices = beforeAnswer.choices || beforeQuestions.find((question) => key(question._id) === key(beforeAnswer.questionId))?.choices;
      if (choices && choices[beforeAnswer.selectedAnswer] !== choices[afterAnswer.selectedAnswer - 1]) {
        throw new Error(`Attempt ${key(before._id)} selected choice changed during index conversion.`);
      }
      if (Object.hasOwn(beforeAnswer, 'correctAnswer')
        && choices?.[beforeAnswer.correctAnswer] !== choices?.[afterAnswer.correctAnswer - 1]) {
        throw new Error(`Attempt ${key(before._id)} saved correct choice changed during index conversion.`);
      }
    }
    const stripIndexes = (attempt) => ({
      ...attempt,
      answers: attempt.answers.map(({ selectedAnswer, correctAnswer, ...answer }) => answer),
    });
    if (digest(stripIndexes(before)) !== digest(stripIndexes(after))) {
      throw new Error(`Attempt ${key(before._id)} scores or non-index data changed during conversion.`);
    }
  }
}

async function runOneBasedMigration(db, client) {
  const migrations = db.collection('readsmartmigrations');
  const existing = await migrations.findOne({ _id: MIGRATION_ID });
  if (existing) return { alreadyApplied: true, ...existing.counts };

  const session = client.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const data = await readLegacyData(db, session);
      if (data.migration) {
        result = { alreadyApplied: true, ...data.migration.counts };
        return;
      }
      const questionUpdates = data.questions.map((question) => ({
        updateOne: {
          filter: { _id: question._id, correctAnswer: question.correctAnswer },
          update: { $set: { correctAnswer: question.correctAnswer + 1 } },
        },
      }));
      const attemptUpdates = data.attempts.map((attempt) => ({
        updateOne: {
          filter: { _id: attempt._id },
          update: { $set: { answers: makeAttemptAfter(attempt).answers } },
        },
      }));

      if (questionUpdates.length) await db.collection('readingquestions').bulkWrite(questionUpdates, { ordered: true, session });
      if (attemptUpdates.length) await db.collection('assessmentattempts').bulkWrite(attemptUpdates, { ordered: true, session });

      const backups = [
        ...data.questions.map((question) => ({
          _id: `${MIGRATION_ID}:question:${key(question._id)}`,
          migrationId: MIGRATION_ID,
          recordType: 'question',
          recordId: question._id,
          beforeCorrectAnswer: question.correctAnswer,
          afterCorrectAnswer: question.correctAnswer + 1,
        })),
        ...data.attempts.map((attempt) => ({
          _id: `${MIGRATION_ID}:attempt:${key(attempt._id)}`,
          migrationId: MIGRATION_ID,
          recordType: 'attempt',
          recordId: attempt._id,
          answerIndexes: attempt.answers.map((answer, index) => ({
            index,
            beforeSelectedAnswer: answer.selectedAnswer,
            afterSelectedAnswer: answer.selectedAnswer + 1,
            ...(Object.hasOwn(answer, 'correctAnswer') ? {
              beforeCorrectAnswer: answer.correctAnswer,
              afterCorrectAnswer: answer.correctAnswer + 1,
            } : {}),
          })),
        })),
      ];
      if (backups.length) await db.collection(BACKUP_COLLECTION).insertMany(backups, { ordered: true, session });

      const afterQuestions = await db.collection('readingquestions')
        .find({}, { session, projection: { _id: 1, choices: 1, correctAnswer: 1 } }).toArray();
      const afterAttempts = await db.collection('assessmentattempts').find({}, { session }).toArray();
      verifyMeaningPreserved(data.questions, afterQuestions, data.attempts, afterAttempts);
      const marker = {
        _id: MIGRATION_ID,
        appliedAt: new Date(),
        counts: {
          convertedQuestions: data.questions.length,
          convertedAttempts: data.attempts.length,
          convertedSelectedAnswers: data.counts.selectedAnswerCount,
          convertedCorrectAnswerSnapshots: data.counts.correctAnswerSnapshotCount,
          questionCount: data.questions.length,
          attemptCount: data.attempts.length,
          answerCount: data.counts.answerCount,
        },
      };
      await migrations.insertOne(marker, { session });
      result = { alreadyApplied: false, ...marker.counts };
    });
  } finally {
    await session.endSession();
  }
  return result;
}

async function rollbackOneBasedMigration(db, client) {
  const migrations = db.collection('readsmartmigrations');
  const session = client.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const marker = await migrations.findOne({ _id: MIGRATION_ID }, { session });
      if (!marker) throw new Error('The one-based migration marker is missing; no rollback was performed.');
      const questions = await db.collection('readingquestions').find({}, { session, projection: { _id: 1, correctAnswer: 1 } }).toArray();
      const attempts = await db.collection('assessmentattempts').find({}, { session }).toArray();
      const backups = await db.collection(BACKUP_COLLECTION).find({ migrationId: MIGRATION_ID }, { session }).toArray();
      const counts = marker.counts || {};
      const answerCount = attempts.reduce((sum, attempt) => sum + (attempt.answers || []).length, 0);
      if (questions.length !== counts.questionCount || attempts.length !== counts.attemptCount || answerCount !== counts.answerCount) {
        throw new Error('Assessment records were added or removed after migration; rollback refused to avoid touching later data.');
      }
      const backupById = new Map(backups.map((backup) => [backup._id, backup]));
      const questionUpdates = questions.map((question) => {
        const backup = backupById.get(`${MIGRATION_ID}:question:${key(question._id)}`);
        if (!backup || question.correctAnswer !== backup.afterCorrectAnswer) {
          throw new Error(`Question ${key(question._id)} changed after migration; rollback refused.`);
        }
        requireIndex(question.correctAnswer, 1, 4, `Question ${key(question._id)} correctAnswer`);
        return { updateOne: { filter: { _id: question._id, correctAnswer: backup.afterCorrectAnswer }, update: { $set: { correctAnswer: backup.beforeCorrectAnswer } } } };
      });
      const attemptUpdates = attempts.map((attempt) => {
        const backup = backupById.get(`${MIGRATION_ID}:attempt:${key(attempt._id)}`);
        if (!backup || backup.answerIndexes.length !== (attempt.answers || []).length) {
          throw new Error(`Attempt ${key(attempt._id)} changed after migration; rollback refused.`);
        }
        const answers = attempt.answers.map((answer, index) => {
          const previous = backup.answerIndexes[index];
          if (previous.index !== index || answer.selectedAnswer !== previous.afterSelectedAnswer
            || (Object.hasOwn(previous, 'afterCorrectAnswer') && answer.correctAnswer !== previous.afterCorrectAnswer)
            || (!Object.hasOwn(previous, 'afterCorrectAnswer') && Object.hasOwn(answer, 'correctAnswer'))) {
            throw new Error(`Attempt ${key(attempt._id)} answer ${index + 1} changed after migration; rollback refused.`);
          }
          requireIndex(answer.selectedAnswer, 1, 4, `Attempt ${key(attempt._id)} selectedAnswer`);
          return {
            ...answer,
            selectedAnswer: previous.beforeSelectedAnswer,
            ...(Object.hasOwn(previous, 'beforeCorrectAnswer') ? { correctAnswer: previous.beforeCorrectAnswer } : {}),
          };
        });
        return { updateOne: { filter: { _id: attempt._id }, update: { $set: { answers } } } };
      });
      if (questionUpdates.length) await db.collection('readingquestions').bulkWrite(questionUpdates, { ordered: true, session });
      if (attemptUpdates.length) await db.collection('assessmentattempts').bulkWrite(attemptUpdates, { ordered: true, session });
      await db.collection(BACKUP_COLLECTION).deleteMany({ migrationId: MIGRATION_ID }, { session });
      await migrations.deleteOne({ _id: MIGRATION_ID }, { session });
      result = { rolledBack: true, restoredQuestions: questions.length, restoredAttempts: attempts.length, restoredAnswers: answerCount };
    });
  } finally {
    await session.endSession();
  }
  return result;
}

async function verifyOneBasedData(db) {
  const marker = await db.collection('readsmartmigrations').findOne({ _id: MIGRATION_ID });
  if (!marker) throw new Error('The one-based migration marker is missing; verification failed.');
  const [questions, attempts, backups] = await Promise.all([
    db.collection('readingquestions').find({}, { projection: { _id: 1, choices: 1, correctAnswer: 1 } }).toArray(),
    db.collection('assessmentattempts').find({}).toArray(),
    db.collection(BACKUP_COLLECTION).find({ migrationId: MIGRATION_ID }).toArray(),
  ]);
  const backupById = new Map(backups.map((backup) => [backup._id, backup]));
  const questionById = new Map(questions.map((question) => [key(question._id), question]));
  const answerCount = attempts.reduce((total, attempt) => total + (attempt.answers || []).length, 0);
  if (questions.length !== marker.counts.questionCount
    || attempts.length !== marker.counts.attemptCount
    || answerCount !== marker.counts.answerCount) {
    throw new Error('Current assessment record counts differ from the migration marker.');
  }
  const questionDistribution = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const question of questions) {
    requireIndex(question.correctAnswer, 1, 4, `Question ${key(question._id)} correctAnswer`);
    if (!Array.isArray(question.choices) || question.choices.length !== 4) throw new Error(`Question ${key(question._id)} does not have four choices.`);
    const backup = backupById.get(`${MIGRATION_ID}:question:${key(question._id)}`);
    if (!backup || question.correctAnswer !== backup.afterCorrectAnswer
      || question.choices[backup.beforeCorrectAnswer] !== question.choices[question.correctAnswer - 1]) {
      throw new Error(`Question ${key(question._id)} does not match its verified migration record.`);
    }
    questionDistribution[question.correctAnswer] += 1;
  }
  for (const attempt of attempts) {
    const backup = backupById.get(`${MIGRATION_ID}:attempt:${key(attempt._id)}`);
    if (!backup || backup.answerIndexes.length !== (attempt.answers || []).length) {
      throw new Error(`Attempt ${key(attempt._id)} does not match its verified migration record.`);
    }
    for (const [index, answer] of attempt.answers.entries()) {
      const previous = backup.answerIndexes[index];
      requireIndex(answer.selectedAnswer, 1, 4, `Attempt ${key(attempt._id)} selectedAnswer`);
      if (previous.index !== index || answer.selectedAnswer !== previous.afterSelectedAnswer
        || (Object.hasOwn(previous, 'afterCorrectAnswer') && answer.correctAnswer !== previous.afterCorrectAnswer)
        || (!Object.hasOwn(previous, 'afterCorrectAnswer') && Object.hasOwn(answer, 'correctAnswer'))) {
        throw new Error(`Attempt ${key(attempt._id)} answer ${index + 1} does not match its verified migration record.`);
      }
      if (Object.hasOwn(answer, 'correctAnswer')) requireIndex(answer.correctAnswer, 1, 4, `Attempt ${key(attempt._id)} correctAnswer snapshot`);
      const choices = answer.choices || questionById.get(key(answer.questionId))?.choices;
      if (choices && choices[previous.beforeSelectedAnswer] !== choices[answer.selectedAnswer - 1]) {
        throw new Error(`Attempt ${key(attempt._id)} selected choice changed.`);
      }
      if (Object.hasOwn(previous, 'beforeCorrectAnswer') && choices?.[previous.beforeCorrectAnswer] !== choices?.[answer.correctAnswer - 1]) {
        throw new Error(`Attempt ${key(attempt._id)} correct choice snapshot changed.`);
      }
    }
  }
  return {
    verifiedQuestions: questions.length,
    verifiedAttempts: attempts.length,
    verifiedSelectedAnswers: answerCount,
    verifiedCorrectAnswerSnapshots: attempts.reduce((total, attempt) => total + (attempt.answers || []).filter((answer) => Object.hasOwn(answer, 'correctAnswer')).length, 0),
    questionDistribution,
    choiceTextMappingVerified: true,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const rollback = args.includes('--rollback');
  const verify = args.includes('--verify');
  if ([apply, rollback, verify].filter(Boolean).length > 1) throw new Error('Choose only one of --apply, --rollback, or --verify.');
  if (args.some((arg) => !['--apply', '--rollback', '--verify'].includes(arg))) throw new Error('Supported options are --apply, --rollback, and --verify.');

  const mongoose = require('mongoose');
  const { getConfig } = require('../config/env');
  await mongoose.connect(getConfig().mongoUri, { autoIndex: false });
  try {
    const db = mongoose.connection.db;
    const client = mongoose.connection.getClient();
    if (verify) {
      console.log(`Assessment index verification: ${JSON.stringify(await verifyOneBasedData(db))}`);
      return;
    }
    if (rollback) {
      console.log(`Assessment index rollback: ${JSON.stringify(await rollbackOneBasedMigration(db, client))}`);
      return;
    }
    if (!apply) {
      const data = await readLegacyData(db);
      if (data.migration) {
        console.log(`One-based migration already applied: ${JSON.stringify(data.migration.counts)}`);
        return;
      }
      console.log(`Dry run only: ${JSON.stringify({
        questionsToConvert: data.questions.length,
        attemptsToConvert: data.attempts.length,
        selectedAnswersToConvert: data.counts.selectedAnswerCount,
        correctAnswerSnapshotsToConvert: data.counts.correctAnswerSnapshotCount,
        answerRecords: data.counts.answerCount,
      })}. Review the counts, then rerun with --apply.`);
      return;
    }
    console.log(`Assessment indexes migrated: ${JSON.stringify(await runOneBasedMigration(db, client))}`);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Assessment answer-index migration failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  BACKUP_COLLECTION,
  MIGRATION_ID,
  inspectLegacyRecords,
  makeAttemptAfter,
  rollbackOneBasedMigration,
  runOneBasedMigration,
  verifyOneBasedData,
  verifyMeaningPreserved,
};
