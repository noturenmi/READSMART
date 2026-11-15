const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

test('notification API methods use the shared authenticated API client', () => {
  const api = read('src/services/api.js');
  assert.match(api, /getNotifications\(page = 1, limit = 25\)[\s\S]*?request\(`\/notifications\?page=/);
  assert.match(api, /getUnreadNotificationCount\(\)[\s\S]*?request\('\/notifications\/unread-count', \{ authenticated: true \}\)/);
  assert.match(api, /markNotificationRead\(notificationId\)[\s\S]*?method: 'PATCH', authenticated: true/);
  assert.match(api, /markAllNotificationsRead\(\)[\s\S]*?request\('\/notifications\/read-all'/);
});

test('Home exposes the unread notification badge and Notification Center through its existing stack', () => {
  const home = read('src/screens/HomeScreen.js');
  const navigator = read('src/navigation/HomeNavigator.js');
  assert.match(home, /api\.getUnreadNotificationCount\(\)/);
  assert.match(home, /accessibilityLabel=.*Notifications/);
  assert.match(home, /navigation\.navigate\('Notifications'\)/);
  assert.match(navigator, /name="Notifications" component=\{NotificationCenterScreen\}/);
});

test('Notification Center covers loading, empty, errors, refresh, read management, paging, and relevant navigation', () => {
  const screen = read('src/screens/NotificationCenterScreen.js');
  assert.match(screen, /api\.getNotifications\(1, PAGE_SIZE\)/);
  assert.match(screen, /Loading notifications/);
  assert.match(screen, /You’re all caught up/);
  assert.match(screen, /Unable to load notifications/);
  assert.match(screen, /Refresh notifications/);
  assert.match(screen, /api\.markAllNotificationsRead\(\)/);
  assert.match(screen, /api\.markNotificationRead\(item\.id\)/);
  assert.match(screen, /screen: 'AssessmentReview'/);
  assert.match(screen, /screen: 'WritingSubmissionDetail'/);
  assert.match(screen, /navigation\.navigate\('DailyGoals'\)/);
});
