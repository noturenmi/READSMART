const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

test('AI screens use only the authenticated READSMART API with longer local-inference timeouts', () => {
  const api = read('src/services/api.js');
  const detail = read('src/screens/LessonDetailScreen.js');
  const writingResult = read('src/screens/WritingResultScreen.js');

  assert.match(api, /getLessonSummary\(lessonId\)[\s\S]*?\/summary[\s\S]*?authenticated: true[\s\S]*?timeoutMs: 105000/u);
  assert.match(api, /getAIWritingFeedback\(lessonId, submissionId\)[\s\S]*?ai-feedback[\s\S]*?authenticated: true[\s\S]*?timeoutMs: 105000/u);
  assert.match(detail, /api\.getLessonSummary\(lessonId\)/u);
  assert.match(writingResult, /api\.getAIWritingFeedback\(lessonId, result\.submissionId\)/u);
  assert.doesNotMatch(api, /127\.0\.0\.1:11434|\/api\/chat|OLLAMA_BASE_URL|AI_API_KEY/u);
});
