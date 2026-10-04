import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Screen } from '../components/Screen';
import { ReadingHeader, ReadingState } from '../components/ReadingComponents';
import { api } from '../services/api';
import { colors } from '../theme';

export function WritingScreen({ navigation }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    api.getWritingActivities()
      .then((data) => { if (active) setActivities(data.activities || []); })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]));

  return (
    <Screen>
      <ReadingHeader title="Writing practice" subtitle="Respond to a prompt connected to a reading lesson." eyebrow="THINK · WRITE · REFLECT" />
      {loading ? <ReadingState kind="loading" title="Loading writing activities..." /> : null}
      {!loading && failed ? (
        <ReadingState kind="error" title="Unable to load writing activities." message="Please check your connection and try again." onRetry={() => setRetry((value) => value + 1)} />
      ) : null}
      {!loading && !failed && activities.length === 0 ? (
        <ReadingState kind="empty" title="No writing activities are available yet." message="Writing activities will appear here when they are ready." />
      ) : null}
      {!loading && !failed ? activities.map((activity) => (
        <ActivityCard
          key={activity.id}
          activity={activity}
          onPress={() => navigation.navigate('WritingActivity', {
            lessonId: activity.lesson.id,
            lessonTitle: activity.lesson.title,
          })}
        />
      )) : null}
      <Text style={styles.note}>Your work is saved to your account. Writing feedback is not part of this activity yet.</Text>
    </Screen>
  );
}

function ActivityCard({ activity, onPress }) {
  const status = activity.submitted ? 'Completed' : 'Not started';
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <Card style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.icon}><Ionicons name="create-outline" size={20} color={colors.greenDark} /></View>
          <Text style={styles.status}>{status}</Text>
        </View>
        <Text style={styles.subject}>{activity.lesson.subject?.name || 'READSMART'}</Text>
        <Text style={styles.title}>Lesson {activity.lesson.lessonNumber}: {activity.lesson.title}</Text>
        <Text style={styles.prompt} numberOfLines={3}>{activity.prompt}</Text>
        {activity.latestResult ? (
          <Text style={styles.result}>Latest score: {activity.latestResult.totalScore} / 25 ({activity.latestResult.percentage}%)</Text>
        ) : null}
        <Text style={styles.action}>{activity.submitted ? 'Try activity again' : 'Start activity'}  ›</Text>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  icon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' },
  status: { color: colors.greenDark, backgroundColor: colors.greenLight, borderRadius: 10, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '700' },
  subject: { color: colors.green, fontSize: 10, fontWeight: '800', letterSpacing: 0.6, marginTop: 3 },
  title: { color: colors.ink, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  prompt: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  result: { color: colors.greenDark, fontSize: 12, fontWeight: '700' },
  action: { color: colors.green, fontSize: 13, fontWeight: '800', marginTop: 3 },
  pressed: { opacity: 0.78 },
  note: { color: colors.muted, textAlign: 'center', fontSize: 11, lineHeight: 17, paddingHorizontal: 12 },
});
