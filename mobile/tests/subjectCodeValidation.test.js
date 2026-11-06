const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

test('admin subject form uses the subject-code format, length limit, and field-level error UI', () => {
  const form = read('src/screens/AdminSubjectsScreen.js');
  const validation = read('src/utils/subjectCodeValidation.js');
  assert.match(validation, /min:\s*2,\s*max:\s*16/);
  assert.match(validation, /\^\[A-Z\]\[A-Z0-9\]\*\(\?:-\[A-Z0-9\]\+\)\*\$/);
  assert.match(form, /getSubjectCodeError\(form\.code\)/);
  assert.match(form, /maxLength=\{SUBJECT_CODE_LIMITS\.max\}/);
  assert.match(form, /error=\{fieldErrors\.code\}/);
  assert.match(form, /trim\(\)\.toUpperCase\(\)/);
});
