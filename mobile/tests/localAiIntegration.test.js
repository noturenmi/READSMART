const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

test('AI screens use only the authenticated READSMART API with longer local-inference timeouts', () => {
  const api = read('src/services/api.js');
  const detail = read('src/screens/LessonDetailScreen.js');
  const writingResult = read('src/screens/WritingResultScreen.js');

  assert.match(api, /getLessonSummary\(lessonId, \{ regenerate = false \}[\s\S]*?\/summary[\s\S]*?authenticated: true[\s\S]*?timeoutMs: 105000/u);
  assert.match(api, /getAIWritingFeedback\(lessonId, submissionId\)[\s\S]*?ai-feedback[\s\S]*?authenticated: true[\s\S]*?timeoutMs: 105000/u);
  assert.match(detail, /api\.getLessonSummary\(lessonId, \{ regenerate \}\)/u);
  assert.match(writingResult, /api\.getAIWritingFeedback\(lessonId, result\.submissionId\)/u);
  assert.doesNotMatch(api, /127\.0\.0\.1:11434|\/api\/chat|OLLAMA_BASE_URL|AI_API_KEY/u);
});

test('lesson summary checks the read-only cache on open and prevents overlapping generation requests', () => {
  const api = read('src/services/api.js');
  const detail = read('src/screens/LessonDetailScreen.js');

  assert.match(api, /getCachedLessonSummary\(lessonId\)[\s\S]*?\/summary[\s\S]*?authenticated: true/u);
  assert.match(api, /getLessonSummary\(lessonId, \{ regenerate = false \}[\s\S]*?method: 'POST'[\s\S]*?body: regenerate \? \{ regenerate: true \} : \{\}/u);
  assert.match(detail, /api\.getCachedLessonSummary\(lessonId\)/u);
  assert.match(detail, /summaryRequestInFlight\.current \|\| summaryCacheLoading/u);
  assert.match(detail, /summary \? 'Regenerate Summary' : 'Generate Summary'/u);
  assert.match(detail, /api\.getLessonSummary\(lessonId, \{ regenerate \}\)/u);
  assert.match(detail, /disabled=\{summaryLoading\}/u);
});
