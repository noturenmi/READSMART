const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

test('Home requests authenticated recommendations and displays lesson, subject, reason, retry, and empty states', () => {
  const home = read('src/screens/HomeScreen.js');
  const api = read('src/services/api.js');

  assert.match(api, /getRecommendedLessons\(\)[\s\S]*request\('\/progress\/recommendations', \{ authenticated: true \}\)/);
  assert.match(home, /useFocusEffect/);
  assert.match(home, /api\.getRecommendedLessons\(\)/);
  assert.match(home, /Recommended Lessons to Review/);
  assert.match(home, /item\.lessonTitle/);
  assert.match(home, /item\.subjectName/);
  assert.match(home, /item\.reason/);
  assert.match(home, /navigation\.navigate\('Reading', \{ screen: 'Lesson', params: \{ lessonId \} \}\)/);
  assert.match(home, /Unable to load lesson recommendations/);
  assert.match(home, /onRetry=\{\(\) => setRecommendationsReload/);
  assert.match(home, /Complete a reading assessment to get lesson recommendations/);
  assert.match(home, /No lessons currently need review/);
  assert.doesNotMatch(home, /Media and Information Literacy|Understanding Culture|Contemporary Philippine Arts|Earth and Life Science/);
});

test('Admin student progress displays recommendation titles and server-provided reasons', () => {
  const screen = read('src/screens/AdminStudentProgressScreen.js');

  assert.match(screen, /api\.adminGetUserProgress\(userId\)/);
  assert.match(screen, /data\.recommendations/);
  assert.match(screen, /item\.lessonTitle/);
  assert.match(screen, /item\.subjectName/);
  assert.match(screen, /item\.reason/);
  assert.match(screen, /recommendationsEmptyReason/);
});
