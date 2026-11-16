const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

test('writing submission replaces the activity with its result in both student stacks', () => {
  const activity = read('src/screens/WritingActivityScreen.js');
  const readingNavigator = read('src/navigation/ReadingNavigator.js');
  const writingNavigator = read('src/navigation/WritingNavigator.js');

  assert.match(activity, /navigation\.replace\('WritingResult',/u);
  assert.match(readingNavigator, /Stack\.Screen name="WritingActivity"[\s\S]*?Stack\.Screen name="WritingResult"/u);
  assert.match(writingNavigator, /Stack\.Screen name="WritingActivity"[\s\S]*?Stack\.Screen name="WritingResult"/u);
});

test('writing result custom Back pops the current stack and leaves Android system Back to native stack handling', () => {
  const result = read('src/screens/WritingResultScreen.js');

  assert.match(result, /function goBackToPreviousScreen\(\)\s*\{\s*if \(navigation\.canGoBack\(\)\) navigation\.goBack\(\);\s*\}/u);
  assert.match(result, /title="Back" onPress=\{goBackToPreviousScreen\}/u);
  assert.doesNotMatch(result, /navigation\.getParent\(\)|navigate\('Reading'|BackHandler|CommonActions\.reset/u);
});
