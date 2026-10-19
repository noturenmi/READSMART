import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../components/Screen';
import { ReadingState } from '../components/ReadingComponents';
import { AdminCard, AdminHeader } from '../components/AdminComponents';
import { api } from '../services/api';
import { colors } from '../theme';

export function AdminStudentProgressScreen({ navigation, route }) {
  const { userId } = route.params;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    api.adminGetUserProgress(userId)
      .then((result) => { if (active) setData(result); })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, reload]));

  const progress = data?.progress;
  return (
    <Screen>
      <AdminHeader title="Student progress" subtitle={data?.student ? `${data.student.name} · ${data.student.email}` : 'Progress details'} onBack={() => navigation.goBack()} />
      {loading ? <ReadingState kind="loading" title="Loading student progress…" /> : null}
      {!loading && failed ? <ReadingState kind="error" title="Unable to load student progress." message="Please try again." onRetry={() => setReload((n) => n + 1)} /> : null}
      {!loading && !failed && progress ? (
        <>
          <AdminCard style={styles.levelCard}>
            <View style={styles.levelRow}>
              <View><Text style={styles.label}>CURRENT LEVEL</Text><Text style={styles.level}>Level {progress.level}</Text></View>
              <Text style={styles.xp}>{progress.totalXP} XP</Text>
            </View>
            <ProgressBar percentage={progress.levelProgressPercentage} />
            <Text style={styles.caption}>{progress.totalXP} / {progress.nextLevelXP} XP toward the next level</Text>
          </AdminCard>
          <AdminCard style={styles.stats}>
            <Metric title="Reading assessments" value={`${progress.readingAssessmentsCompleted} / ${progress.totalReadingAssessments}`} />
            <Metric title="Writing activities" value={`${progress.writingActivitiesCompleted} / ${progress.totalWritingActivities}`} />
            <Metric title="Lessons completed" value={`${progress.lessonsCompleted} / ${progress.totalLessons}`} />
            <Metric title="Overall progress" value={`${progress.overallProgressPercentage}%`} />
            <Metric title="Last activity" value={formatDate(progress.lastActivityAt)} />
          </AdminCard>
          <Text style={styles.heading}>Subject progress</Text>
          {(data.subjects || []).map((subject) => (
            <AdminCard key={subject.subjectId} style={styles.subject}>
              <View style={styles.subjectRow}>
                <View style={styles.subjectCopy}>
                  <Text style={styles.subjectCode}>{subject.subjectCode}</Text>
                  <Text style={styles.subjectName}>{subject.subjectName}</Text>
                </View>
                <Text style={styles.percent}>{subject.percentage}%</Text>
              </View>
              <Text style={styles.caption}>{subject.completedLessons} / {subject.totalLessons} lessons</Text>
              <ProgressBar percentage={subject.percentage} />
              <Text style={styles.caption}>Reading assessments: {subject.completedReadingAssessments} / {subject.totalReadingAssessments}</Text>
              <Text style={styles.caption}>Writing activities: {subject.completedWritingActivities} / {subject.totalWritingActivities}</Text>
              <Text style={styles.subjectXP}>{subject.totalXP} XP earned in this subject</Text>
            </AdminCard>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

function Metric({ title, value }) {
  return <View style={styles.metric}><Text style={styles.metricLabel}>{title}</Text><Text style={styles.metricValue}>{value}</Text></View>;
}

function ProgressBar({ percentage }) {
  const width = `${Math.min(100, Math.max(0, Number(percentage) || 0))}%`;
  return <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Number(percentage) || 0 }} style={styles.track}><View style={[styles.fill, { width }]} /></View>;
}

function formatDate(value) {
  if (!value) return 'No activity yet';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

const styles = StyleSheet.create({
  levelCard: { gap: 10, backgroundColor: colors.greenLight, borderColor: '#D8E8DC' },
  levelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: colors.green, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  level: { color: colors.greenDark, fontSize: 19, fontWeight: '800', marginTop: 3 },
  xp: { color: colors.greenDark, fontSize: 16, fontWeight: '800' },
  track: { height: 9, backgroundColor: '#D5E4D8', borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.green, borderRadius: 5 },
  caption: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  stats: { gap: 12 },
  metric: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  metricLabel: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 18 },
  metricValue: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  heading: { color: colors.greenDark, fontSize: 16, fontWeight: '800' },
  subject: { gap: 8, padding: 14 },
  subjectRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  subjectCopy: { flex: 1, minWidth: 0 },
  subjectCode: { color: colors.green, fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  subjectName: { color: colors.ink, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  percent: { color: colors.greenDark, fontSize: 12, fontWeight: '800' },
  subjectXP: { color: colors.greenDark, fontSize: 11, lineHeight: 16, fontWeight: '700' },
});
