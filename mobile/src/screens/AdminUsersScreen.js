import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { ReadingState } from '../components/ReadingComponents';
import { AdminButton, AdminCard, AdminHeader } from '../components/AdminComponents';
import { api } from '../services/api';
import { colors } from '../theme';

export function AdminUsersScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    api.adminGetUsers(page)
      .then((result) => { if (active) setData(result); })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, reload]));

  return (
    <Screen>
      <AdminHeader title="Student accounts" subtitle="Basic account details and a current progress snapshot." onBack={() => navigation.goBack()} />
      {loading ? <ReadingState kind="loading" title="Loading students…" /> : null}
      {!loading && failed ? <ReadingState kind="error" title="Unable to load student accounts." message="Please check the server connection and try again." onRetry={() => setReload((n) => n + 1)} /> : null}
      {!loading && !failed && data?.users?.length === 0 ? <ReadingState kind="empty" title="No student accounts yet." message="Registered student accounts will appear here." /> : null}
      {!loading && !failed ? data?.users?.map((student) => (
        <Pressable key={student.id} accessibilityRole="button" onPress={() => navigation.navigate('AdminStudentProgress', { userId: student.id })}>
          <AdminCard style={styles.card}>
            <View style={styles.top}>
              <View style={styles.avatar}><Ionicons name="person-outline" size={18} color={colors.greenDark} /></View>
              <View style={styles.identity}>
                <Text style={styles.name}>{student.name}</Text>
                <Text style={styles.email}>{student.email}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </View>
            <View style={styles.metrics}>
              <Info label="Level" value={String(student.level)} />
              <Info label="XP" value={String(student.totalXP)} />
              <Info label="Progress" value={`${student.overallProgressPercentage}%`} />
            </View>
            <Text style={styles.date}>Account created {formatDate(student.createdAt)}</Text>
          </AdminCard>
        </Pressable>
      )) : null}
      {!loading && !failed && data?.pagination?.totalPages > 1 ? (
        <View style={styles.pagination}>
          <AdminButton title="Previous" secondary disabled={page <= 1} onPress={() => setPage((value) => Math.max(1, value - 1))} />
          <Text style={styles.page}>{page} / {data.pagination.totalPages}</Text>
          <AdminButton title="Next" secondary disabled={page >= data.pagination.totalPages} onPress={() => setPage((value) => value + 1)} />
        </View>
      ) : null}
    </Screen>
  );
}

function Info({ label, value }) {
  return <View style={styles.info}><Text style={styles.infoValue}>{value}</Text><Text style={styles.infoLabel}>{label}</Text></View>;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

const styles = StyleSheet.create({
  card: { gap: 12, padding: 13 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 37, height: 37, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.greenLight },
  identity: { flex: 1, minWidth: 0 },
  name: { color: colors.ink, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  email: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  metrics: { flexDirection: 'row', borderTopWidth: 1, borderColor: colors.border, paddingTop: 10 },
  info: { flex: 1, alignItems: 'center' },
  infoValue: { color: colors.greenDark, fontSize: 15, fontWeight: '800' },
  infoLabel: { color: colors.muted, fontSize: 10, marginTop: 2 },
  date: { color: colors.muted, fontSize: 10 },
  pagination: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  page: { flex: 1, color: colors.muted, fontSize: 12, textAlign: 'center' },
});
