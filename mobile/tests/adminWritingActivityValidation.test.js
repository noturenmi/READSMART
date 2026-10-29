const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

test('admin writing activity form applies title, prompt, and instruction limits with field-specific feedback', () => {
  const screen = read('src/screens/AdminWritingActivitiesScreen.js');
  const validation = read('src/utils/writingActivityValidation.js');
  const fields = read('src/components/AdminComponents.js');

  assert.match(validation, /title:\s*160/);
  assert.match(validation, /prompt:\s*4000/);
  assert.match(validation, /instructions:\s*4000/);
  assert.match(validation, /getWritingActivityLengthErrors/);
  assert.match(validation, /getWritingActivityApiFeedback/);
  assert.match(screen, /maxLength=\{WRITING_ACTIVITY_LIMITS\.title\}/);
  assert.match(screen, /maxLength=\{WRITING_ACTIVITY_LIMITS\.prompt\}/);
  assert.match(screen, /maxLength=\{WRITING_ACTIVITY_LIMITS\.instructions\}/);
  assert.match(screen, /helperText=\{`\$\{form\.prompt\.length\}/);
  assert.match(screen, /error=\{fieldErrors\.prompt\}/);
  assert.match(fields, /accessibilityRole="alert" style=\{styles\.fieldError\}/);
});

test('multiline prompt and instructions remain enabled in the admin activity form', () => {
  const screen = read('src/screens/AdminWritingActivitiesScreen.js');
  assert.match(screen, /label="Writing prompt"[\s\S]*?multiline/);
  assert.match(screen, /label="Instructions"[\s\S]*?multiline/);
});
