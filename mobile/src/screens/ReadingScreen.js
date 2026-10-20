import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Screen } from '../components/Screen';
import { ReadingHeader, ReadingState, SubjectCard } from '../components/ReadingComponents';
import { api } from '../services/api';
import { colors } from '../theme';
import { getLearningFlow } from '../utils/learningFlow';

export function ReadingScreen({ navigation, route }) {
  const flow = getLearningFlow(route.params?.flow);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    api.getSubjects()
      .then((data) => { if (active) setSubjects(data.subjects || []); })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);

  return (
    <Screen>
      <ReadingHeader
        title={flow.libraryTitle}
        subtitle={flow.librarySubtitle}
        eyebrow={flow.libraryEyebrow}
      />
      {flow.key === 'writing' ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('WritingHistory')}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Card style={styles.historyCard}>
            <View style={styles.historyIcon}><Ionicons name="time-outline" size={20} color={colors.greenDark} /></View>
            <View style={styles.historyCopy}>
              <Text style={styles.historyTitle}>My Writing Submissions</Text>
              <Text style={styles.historySubtitle}>Review your previous responses and feedback</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Card>
        </Pressable>
      ) : null}
      {loading ? <ReadingState kind="loading" title="Loading subjects..." /> : null}
      {!loading && failed ? (
        <ReadingState kind="error" title="Unable to load subjects." message="Please check your connection and try again." onRetry={() => setAttempt((value) => value + 1)} />
      ) : null}
      {!loading && !failed && subjects.length === 0 ? (
        <ReadingState
          kind="empty"
          title="No subjects are available yet."
          message={flow.noSubjectsMessage}
        />
      ) : null}
      {!loading && !failed ? subjects.map((subject) => (
        <SubjectCard
          key={subject.id}
          subject={subject}
          onPress={() => navigation.navigate('Lessons', {
            subjectId: subject.id,
            subjectName: subject.name,
            subjectCode: subject.code,
            flow: flow.key,
          })}
        />
      )) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  historyCard: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13 },
  historyIcon: { width: 39, height: 39, borderRadius: 13, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' },
  historyCopy: { flex: 1, minWidth: 0 },
  historyTitle: { color: colors.greenDark, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  historySubtitle: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  pressed: { opacity: 0.78 },
});
