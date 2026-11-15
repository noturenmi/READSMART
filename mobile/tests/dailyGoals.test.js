const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

test('daily goal API uses authenticated endpoints and sends only student target quantities', () => {
  const api = read('src/services/api.js');
  assert.match(api, /getDailyGoalsToday\(\)[\s\S]*?request\('\/daily-goals\/today', \{ authenticated: true \}\)/);
  assert.match(api, /updateDailyGoalTargets\(targets\)[\s\S]*?method: 'PUT', body: \{ targets \}, authenticated: true/);
  assert.match(api, /getDailyGoalHistory\(page = 1, limit = 14\)[\s\S]*?request\(`\/daily-goals\/history\?page=\$\{page\}&limit=\$\{limit\}`, \{ authenticated: true \}\)/);
  assert.doesNotMatch(api, /updateDailyGoalTargets\([^)]*userId|xpEarned|completedGoals/);
});

test('Home dashboard links to Daily Goals through a nested home stack without changing the student tab set', () => {
  const home = read('src/screens/HomeScreen.js');
  const tabs = read('src/navigation/StudentTabs.js');
  const navigator = read('src/navigation/HomeNavigator.js');
  assert.match(home, /Daily Learning Goals/);
  assert.match(home, /navigation\.navigate\('DailyGoals'\)/);
  assert.match(tabs, /name="Home" component=\{HomeNavigator\}/);
  assert.match(navigator, /name="HomeDashboard" component=\{HomeScreen\}/);
  assert.match(navigator, /name="DailyGoals" component=\{DailyLearningGoalsScreen\}/);
});

test('Daily goal screen displays targets, completion, accessible progress, and retained history states', () => {
  const screen = read('src/screens/DailyLearningGoalsScreen.js');
  assert.match(screen, /api\.getDailyGoalsToday\(\)/);
  assert.match(screen, /api\.updateDailyGoalTargets\(targets\)/);
  assert.match(screen, /api\.getDailyGoalHistory\(\)/);
  assert.match(screen, /readingLessons/);
  assert.match(screen, /assessments/);
  assert.match(screen, /writingActivities/);
  assert.match(screen, /Math\.max\(1, Math\.min\(10/);
  assert.match(screen, /completionPercentage/);
  assert.match(screen, /accessibilityRole="progressbar"/);
  assert.match(screen, /Daily goal history/);
  assert.match(screen, /No previous goal days yet/);
  assert.match(screen, /Unable to load daily goals/);
  assert.match(screen, /Asia\/Manila/);
});
