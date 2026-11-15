const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('admin analytics uses the existing authenticated API and is registered in admin navigation', () => {
  const api = read('src/services/api.js');
  const routes = read('src/navigation/AdminNavigator.js');
  const dashboard = read('src/screens/AdminDashboardScreen.js');
  assert.match(api, /adminGetLearningAnalytics\(period = 'weekly'\)[\s\S]*?request\(`\/admin\/analytics\?period=\$\{encodeURIComponent\(period\)\}`, \{ authenticated: true \}\)/);
  assert.match(routes, /name="AdminLearningAnalytics" component=\{AdminLearningAnalyticsScreen\}/);
  assert.match(dashboard, /Learning Analytics[\s\S]*?AdminLearningAnalytics/);
});

test('analytics screen provides period filters, live summaries, charts, subject breakdowns, and retry states', () => {
  const screen = read('src/screens/AdminLearningAnalyticsScreen.js');
  assert.match(screen, /api\.adminGetLearningAnalytics\(period\)/);
  for (const period of ['daily', 'weekly', 'monthly', 'allTime']) assert.ok(screen.includes(`key: '${period}'`));
  for (const field of ['totalStudents', 'activeLearners', 'completedReadingLessons', 'completedAssessments', 'completedWritingActivities']) {
    assert.ok(screen.includes(`['${field}'`));
  }
  assert.match(screen, /Learning activity over time/);
  assert.match(screen, /Average performance over time/);
  assert.match(screen, /Subject performance/);
  assert.match(screen, /No learning activity recorded yet/);
  assert.match(screen, /Unable to load analytics/);
  assert.match(screen, /Refresh analytics/);
});
