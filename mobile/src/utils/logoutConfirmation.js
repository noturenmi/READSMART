function showLogoutConfirmation(signOut, alertApi) {
  const dialog = alertApi || require('react-native').Alert;
  dialog.alert(
    'Log out',
    'Are you sure you want to log out?',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: signOut },
    ],
  );
}

module.exports = { showLogoutConfirmation };
