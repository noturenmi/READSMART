const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

test('student and admin report requests use the existing authenticated API client', () => {
  const api = read('src/services/api.js');
  assert.match(api, /getLearningReport()[\s\S]*?request\('\/progress\/report', \{ authenticated: true \}\)/);
  assert.match(api, /adminGetUserProgress\(userId\)[\s\S]*?\/progress`, \{ authenticated: true \}\)/);
});

test('progress and admin student progress screens show report data and preserve writing history navigation', () => {
  const student = read('src/screens/ProgressScreen.js');
  const admin = read('src/screens/AdminStudentProgressScreen.js');
  const report = read('src/components/LearningReportSection.js');
  assert.match(student, /api\.getLearningReport\(\)/);
  assert.match(student, /<LearningReportSection/);
  assert.match(student, /screen: 'WritingSubmissionDetail'/);
  assert.match(admin, /data\.learningReport/);
  assert.match(admin, /<LearningReportSection[\s\S]*?admin/);
  assert.match(admin, /'AdminWritingSubmissionDetail'/);
  assert.match(report, /Performance by Subject/);
  assert.match(report, /Reading assessment history/);
  assert.match(report, /Recent writing submissions/);
  assert.match(report, /Complete more assessments to see your performance trend/);
  assert.match(report, /report\.comparisonNote/);
  assert.match(report, /raw result, not compared/);
  assert.match(report, /Open submission details/);
  assert.doesNotMatch(report, /overall reading.*writing score/i);
});
