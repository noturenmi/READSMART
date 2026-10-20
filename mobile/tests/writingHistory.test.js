const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

test('Writing Enhancement exposes history and registers list and detail screens in its existing stack', () => {
  const subjects = read('src/screens/ReadingScreen.js');
  const navigator = read('src/navigation/WritingNavigator.js');

  assert.match(subjects, /My Writing Submissions/);
  assert.match(subjects, /navigation\.navigate\('WritingHistory'\)/);
  assert.match(navigator, /Stack\.Screen name="WritingHistory" component=\{WritingHistoryScreen\}/);
  assert.match(navigator, /Stack\.Screen name="WritingSubmissionDetail" component=\{WritingSubmissionDetailScreen\}/);
});

test('writing history uses authenticated student/admin APIs and renders useful loading, empty, error, and detail states', () => {
  const api = read('src/services/api.js');
  const screen = read('src/screens/WritingHistoryScreen.js');
  const adminProgress = read('src/screens/AdminStudentProgressScreen.js');

  assert.match(api, /getMyWritingSubmissionHistory\(page = 1, limit = 20\)[\s\S]*?request\(`\/writing\/submissions\?page=\$\{page\}&limit=\$\{limit\}`, \{ authenticated: true \}\)/);
  assert.match(api, /getMyWritingSubmission\(submissionId\)[\s\S]*?request\(`\/writing\/submissions\/\$\{encodeURIComponent\(submissionId\)\}`, \{ authenticated: true \}\)/);
  assert.match(api, /adminGetWritingSubmissionHistory\(userId, page = 1, limit = 20\)/);
  assert.match(screen, /Loading writing submissions/);
  assert.match(screen, /No writing submissions yet/);
  assert.match(screen, /Unable to load writing history/);
  assert.match(screen, /Original writing submission/);
  assert.match(screen, /Assessment results/);
  assert.match(screen, /Writing feedback/);
  assert.match(screen, /navigation\.goBack\(\)/);
  assert.match(adminProgress, /View writing submissions/);
  assert.match(adminProgress, /navigation\.navigate\('AdminWritingHistory'/);
});

test('writing submission retry key is stable for the same response and cleared after edits', () => {
  const screen = read('src/screens/WritingActivityScreen.js');

  assert.match(screen, /requestKey\.current \|\|= createRequestKey\(\)/);
  assert.match(screen, /submittingRef\.current/);
  assert.match(screen, /if \(text !== response\) requestKey\.current = null/);
  assert.match(screen, /api\.submitLessonWriting\(lessonId, activity\.id, response, requestKey\.current\)/);
});
