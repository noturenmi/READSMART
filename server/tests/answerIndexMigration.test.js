const assert = require('node:assert/strict');
const { test } = require('node:test');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { MongoClient, ObjectId } = require('mongodb');
const {
  MIGRATION_ID,
  inspectLegacyRecords,
  makeAttemptAfter,
  rollbackOneBasedMigration,
  runOneBasedMigration,
  verifyMeaningPreserved,
} = require('../scripts/migrateAssessmentAnswerIndexesToOneBased');

function sampleRecords() {
  const question = {
    _id: 'question-1',
    choices: ['Choice one', 'Choice two', 'Choice three', 'Choice four'],
    correctAnswer: 3,
    question: 'Which choice is correct?',
  };
  const attempt = {
    _id: 'attempt-1',
    score: 1,
    totalItems: 1,
    totalPoints: 1,
    percentage: 100,
    answers: [{ questionId: question._id, selectedAnswer: 3, correctAnswer: 3, choices: question.choices, isCorrect: true, pointsEarned: 1 }],
  };
  return { question, attempt };
}

test('migration preflight accepts a fully zero-based catalog and counts answer fields', () => {
  const { question, attempt } = sampleRecords();
  assert.deepEqual(inspectLegacyRecords([question], [attempt]), {
    answerCount: 1,
    selectedAnswerCount: 1,
    correctAnswerSnapshotCount: 1,
  });
});

test('migration preflight refuses out-of-range values and incomplete choice records', () => {
  const { question, attempt } = sampleRecords();
  assert.throws(() => inspectLegacyRecords([{ ...question, correctAnswer: 4 }], [attempt]), /integer from 0 through 3/);
  assert.throws(() => inspectLegacyRecords([question], [{ ...attempt, answers: [{ ...attempt.answers[0], selectedAnswer: -1 }] }]), /integer from 0 through 3/);
  assert.throws(() => inspectLegacyRecords([{ ...question, choices: question.choices.slice(0, 3) }], [attempt]), /four choices/);
});

test('one-based conversion preserves answer text, score, correctness, and other saved attempt data', () => {
  const { question, attempt } = sampleRecords();
  const afterQuestion = { ...question, correctAnswer: question.correctAnswer + 1 };
  const afterAttempt = makeAttemptAfter(attempt);
  assert.equal(afterAttempt.answers[0].selectedAnswer, 4);
  assert.equal(afterAttempt.answers[0].correctAnswer, 4);
  assert.equal(afterAttempt.answers[0].choices[afterAttempt.answers[0].selectedAnswer - 1], attempt.answers[0].choices[attempt.answers[0].selectedAnswer]);
  assert.equal(afterAttempt.answers[0].choices[afterAttempt.answers[0].correctAnswer - 1], attempt.answers[0].choices[attempt.answers[0].correctAnswer]);
  assert.equal(afterAttempt.score, attempt.score);
  assert.equal(afterAttempt.percentage, attempt.percentage);
  assert.equal(afterAttempt.answers[0].isCorrect, attempt.answers[0].isCorrect);
  assert.equal(afterAttempt.answers[0].pointsEarned, attempt.answers[0].pointsEarned);
  assert.doesNotThrow(() => verifyMeaningPreserved([question], [afterQuestion], [attempt], [afterAttempt]));

  const alteredAttempt = { ...afterAttempt, score: 0 };
  assert.throws(() => verifyMeaningPreserved([question], [afterQuestion], [attempt], [alteredAttempt]), /scores or non-index data changed/);
});

test('database migration is transactional, idempotent, and reverses only the converted index fields', async () => {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const client = new MongoClient(replSet.getUri());
  await client.connect();
  try {
    const db = client.db('answer_index_migration_test');
    const questions = db.collection('readingquestions');
    const attempts = db.collection('assessmentattempts');
    const migrations = db.collection('readsmartmigrations');
    await migrations.insertOne({ _id: 'question-correct-answer-zero-based-v1', convertedQuestions: 1 });
    const questionId = new ObjectId();
    const attemptId = new ObjectId();
    const choices = ['First', 'Second', 'Third', 'Fourth'];
    await questions.insertOne({ _id: questionId, choices, correctAnswer: 3, question: 'Preserve this question.' });
    await attempts.insertOne({
      _id: attemptId,
      score: 1,
      totalItems: 2,
      totalPoints: 2,
      percentage: 50,
      submittedAt: new Date('2026-01-01T00:00:00.000Z'),
      answers: [
        { questionId, choices, selectedAnswer: 3, correctAnswer: 3, isCorrect: true, pointsEarned: 1 },
        { questionId, choices, selectedAnswer: 0, isCorrect: false, pointsEarned: 0 },
      ],
    });

    const applied = await runOneBasedMigration(db, client);
    assert.equal(applied.convertedQuestions, 1);
    assert.equal(applied.convertedSelectedAnswers, 2);
    assert.equal(applied.convertedCorrectAnswerSnapshots, 1);
    assert.equal((await questions.findOne({ _id: questionId })).correctAnswer, 4);
    const convertedAttempt = await attempts.findOne({ _id: attemptId });
    assert.deepEqual(convertedAttempt.answers.map(({ selectedAnswer }) => selectedAnswer), [4, 1]);
    assert.equal(convertedAttempt.answers[0].correctAnswer, 4);
    assert.equal(convertedAttempt.score, 1);
    assert.equal(convertedAttempt.percentage, 50);
    assert.equal((await runOneBasedMigration(db, client)).alreadyApplied, true);

    const rolledBack = await rollbackOneBasedMigration(db, client);
    assert.equal(rolledBack.rolledBack, true);
    assert.equal((await questions.findOne({ _id: questionId })).correctAnswer, 3);
    const restoredAttempt = await attempts.findOne({ _id: attemptId });
    assert.deepEqual(restoredAttempt.answers.map(({ selectedAnswer }) => selectedAnswer), [3, 0]);
    assert.equal(restoredAttempt.answers[0].correctAnswer, 3);
    assert.equal(restoredAttempt.score, 1);
    assert.equal(restoredAttempt.percentage, 50);
    assert.equal(await migrations.findOne({ _id: MIGRATION_ID }), null);
    assert.equal(await db.collection('readsmartmigrationbackups').countDocuments(), 0);

    assert.equal((await runOneBasedMigration(db, client)).alreadyApplied, false);
    assert.equal((await questions.findOne({ _id: questionId })).correctAnswer, 4);
  } finally {
    await client.close();
    await replSet.stop();
  }
});
