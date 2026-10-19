const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

test('assessment result opens the registered, authenticated review for its submitted attempt', () => {
  const resultScreen = read('src/screens/AssessmentResultScreen.js');
  const navigator = read('src/navigation/ReadingNavigator.js');
  const api = read('src/services/api.js');

  assert.match(resultScreen, /title="Review Incorrect Answers"/);
  assert.match(resultScreen, /navigation\.navigate\('AssessmentReview', \{ lessonId, lessonTitle, attemptId: result\.attemptId \}\)/);
  assert.match(navigator, /Stack\.Screen name="AssessmentReview" component=\{AssessmentReviewScreen\}/);
  assert.match(api, /getAssessmentReview\(lessonId, attemptId\)/);
  assert.match(api, /assessment-attempts\/\$\{encodeURIComponent\(attemptId\)\}\/review/);
  assert.match(api, /\{ authenticated: true \}/);
});

test('answer review provides loading, retry, unavailable-record, and all-correct states', () => {
  const screen = read('src/screens/AssessmentReviewScreen.js');

  assert.match(screen, /Loading your answer review/);
  assert.match(screen, /Unable to load your review/);
  assert.match(screen, /onRetry=\{\(\) => setReload/);
  assert.match(screen, /Your Answer/i);
  assert.match(screen, /Correct Answer/i);
  assert.match(screen, /Explanation/);
  assert.match(screen, /Excellent! You answered all questions correctly/);
  assert.match(screen, /original question details are no longer available/i);
});
