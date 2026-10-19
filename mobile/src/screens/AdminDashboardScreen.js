import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { ReadingState } from '../components/ReadingComponents';
import { AdminCard, AdminHeader, AdminSectionTitle } from '../components/AdminComponents';
import { useAuth } from '../auth/AuthContext';
import { api } from '../services/api';
import { colors } from '../theme';
import { showLogoutConfirmation } from '../utils/logoutConfirmation';
import { PrimaryButton } from '../components/AuthForm';

const statTiles = [
  ['totalStudents', 'Students', 'people-outline'],
  ['totalSubjects', 'Subjects', 'library-outline'],
  ['totalLessons', 'Lessons', 'book-outline'],
  ['publishedLessons', 'Published lessons', 'eye-outline'],
  ['totalReadingQuestions', 'Reading questions', 'help-circle-outline'],
  ['totalWritingActivities', 'Writing activities', 'create-outline'],
];

export function AdminDashboardScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError(false);
    api.adminGetDashboard()
      .then((data) => { if (active) setDashboard(data); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]));

  const shortcuts = [
    ['Student Accounts', 'Review student profiles and progress', 'people-outline', 'AdminUsers'],
    ['Subjects', 'Create, update, and publish subjects', 'library-outline', 'AdminSubjects'],
    ['Lessons & Activities', 'Manage lessons, questions, and writing activities', 'book-outline', 'AdminLessons'],
  ];

  return (
    <Screen>
      <AdminHeader
        title="Administrator dashboard"
        subtitle={`Welcome, ${user?.name || 'Administrator'}`}
      />
      <PrimaryButton title="Logout" onPress={() => showLogoutConfirmation(signOut)} />

      <AdminSectionTitle hint="Live totals from the READSMART database.">System Overview</AdminSectionTitle>
      {loading ? <ReadingState kind="loading" title="Loading dashboard…" /> : null}
      {!loading && error ? <ReadingState kind="error" title="Unable to load dashboard." message="Check the server connection and try again." onRetry={() => setReload((n) => n + 1)} /> : null}
      {!loading && !error && dashboard ? (
        <View style={styles.stats}>
          {statTiles.map(([key, label, icon]) => (
            <AdminCard key={key} style={styles.stat}>
              <Ionicons name={icon} size={20} color={colors.green} />
              <Text style={styles.value}>{dashboard[key] ?? 0}</Text>
              <Text style={styles.label}>{label}</Text>
            </AdminCard>
          ))}
        </View>
      ) : null}

      <AdminSectionTitle hint="Administrator access is enforced by the API as well as this role-specific navigation.">Manage READSMART</AdminSectionTitle>
      {shortcuts.map(([title, subtitle, icon, screen]) => (
        <Pressable key={screen} accessibilityRole="button" onPress={() => navigation.navigate(screen)}>
          <AdminCard style={styles.shortcut}>
            <View style={styles.shortcutIcon}><Ionicons name={icon} size={20} color={colors.greenDark} /></View>
            <View style={styles.shortcutCopy}>
              <Text style={styles.shortcutTitle}>{title}</Text>
              <Text style={styles.shortcutSubtitle}>{subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </AdminCard>
        </Pressable>
      ))}

      {dashboard?.recentActivity?.length ? (
        <>
          <AdminSectionTitle hint="Latest XP-earning learning activity; no credentials or student contact details are shown here.">Recent Student Activity</AdminSectionTitle>
          {dashboard.recentActivity.map((activity) => (
            <AdminCard key={activity.id} style={styles.activity}>
              <Ionicons name="time-outline" size={18} color={colors.green} />
              <View style={styles.shortcutCopy}>
                <Text style={styles.activityTitle}>{activity.activity}</Text>
                <Text style={styles.activitySubtitle}>{activity.studentName} · {activity.lessonTitle}</Text>
              </View>
            </AdminCard>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  stat: { flexBasis: '30%', flexGrow: 1, minWidth: 96, padding: 12, gap: 5 },
  value: { color: colors.ink, fontSize: 21, fontWeight: '800' },
  label: { color: colors.muted, fontSize: 10, lineHeight: 14 },
  shortcut: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13 },
  shortcutIcon: { width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.greenLight },
  shortcutCopy: { flex: 1, minWidth: 0 },
  shortcutTitle: { color: colors.ink, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  shortcutSubtitle: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  activity: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 12 },
  activityTitle: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  activitySubtitle: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
});
