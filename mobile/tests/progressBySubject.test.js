const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

test('student progress screen renders live subject completion, activity counts, XP, and percentage', () => {
  const screen = read('src/screens/ProgressScreen.js');

  assert.match(screen, /api\.getLearningReport\(\)/);
  assert.match(screen, /result\.subjects/);
  assert.match(screen, /Progress by Subject/);
  assert.match(screen, /subject\.subjectName/);
  assert.match(screen, /subject\.percentage/);
  assert.match(screen, /subject\.completedLessons.*subject\.totalLessons/);
  assert.match(screen, /subject\.completedReadingAssessments.*subject\.totalReadingAssessments/);
  assert.match(screen, /subject\.completedWritingActivities.*subject\.totalWritingActivities/);
  assert.match(screen, /subject\.totalXP/);
  assert.doesNotMatch(screen, /Media and Information Literacy|Understanding Culture|Contemporary Philippine Arts|Earth and Life Science/);
});

test('admin student progress screen renders server-calculated subject activity and XP values', () => {
  const screen = read('src/screens/AdminStudentProgressScreen.js');

  assert.match(screen, /api\.adminGetUserProgress\(userId\)/);
  assert.match(screen, /data\.subjects/);
  assert.match(screen, /subject\.completedReadingAssessments/);
  assert.match(screen, /subject\.completedWritingActivities/);
  assert.match(screen, /subject\.totalXP/);
});
