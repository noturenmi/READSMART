const assert = require('node:assert/strict');
const { test } = require('node:test');
const { showLogoutConfirmation } = require('../src/utils/logoutConfirmation');

test('admin logout confirmation keeps the session until Logout is selected', async () => {
  let alertArguments;
  let logoutCount = 0;
  const alertApi = {
    alert: (...args) => { alertArguments = args; },
  };

  showLogoutConfirmation(async () => { logoutCount += 1; }, alertApi);

  assert.equal(alertArguments[0], 'Log out');
  assert.equal(alertArguments[1], 'Are you sure you want to log out?');
  const buttons = alertArguments[2];
  assert.deepEqual(buttons.map(({ text, style }) => ({ text, style })), [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Logout', style: 'destructive' },
  ]);
  assert.equal(logoutCount, 0);

  await buttons[1].onPress();
  assert.equal(logoutCount, 1);
});
