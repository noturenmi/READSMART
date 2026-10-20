const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

test('Progress requests authenticated achievements and displays earned and locked badge states', () => {
  const api = read('src/services/api.js');
  const screen = read('src/screens/ProgressScreen.js');
  const tabs = read('src/navigation/StudentTabs.js');

  assert.match(api, /getMyAchievements\(\)[\s\S]*request\('\/progress\/achievements', \{ authenticated: true \}\)/);
  assert.match(screen, /api\.getMyAchievements\(\)/);
  assert.match(screen, /My Achievements/);
  assert.match(screen, /badge\.earned \? 'EARNED' : 'LOCKED'/);
  assert.match(screen, /badge\.earnedAt/);
  assert.match(screen, /badge\.progress\?\.percentage/);
  assert.match(screen, /Unable to load achievements/);
  assert.match(screen, /Loading achievements/);
  assert.match(tabs, /name="Progress" component=\{ProgressScreen\}/);
});

test('Admin student progress shows server-calculated achievement and earning details', () => {
  const screen = read('src/screens/AdminStudentProgressScreen.js');

  assert.match(screen, /Achievement badges/);
  assert.match(screen, /data\.achievements\?\.badges/);
  assert.match(screen, /badge\.name/);
  assert.match(screen, /badge\.description/);
  assert.match(screen, /badge\.earnedAt/);
  assert.match(screen, /badge\.progress\?\.percentage/);
});
