import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { ReadingState } from '../components/ReadingComponents';
import { AdminButton, AdminCard, AdminHeader, AdminSectionTitle } from '../components/AdminComponents';
import { LearningReportSection } from '../components/LearningReportSection';
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
          <AdminButton
            title="View writing submissions"
            icon="document-text-outline"
            secondary
            onPress={() => navigation.navigate('AdminWritingHistory', {
              adminUserId: userId,
              userName: data.student?.name,
            })}
          />
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
          <AdminSectionTitle hint="Achievement eligibility is calculated from this student's saved assessment and writing records.">
            Achievement badges
          </AdminSectionTitle>
          {(data.achievements?.badges || []).length ? data.achievements.badges.map((badge) => (
            <AdminCard
              key={badge.id}
              style={[styles.achievement, badge.earned ? styles.achievementEarned : styles.achievementLocked]}
            >
              <View style={styles.achievementRow}>
                <View style={[styles.achievementIcon, badge.earned ? styles.achievementIconEarned : styles.achievementIconLocked]}>
                  <Ionicons name={badge.icon || 'ribbon-outline'} size={18} color={badge.earned ? colors.greenDark : colors.muted} />
                </View>
                <View style={styles.subjectCopy}>
                  <Text style={styles.subjectName}>{badge.name} · {badge.earned ? 'Earned' : 'Locked'}</Text>
                  <Text style={styles.caption}>{badge.description}</Text>
                </View>
              </View>
              <Text style={styles.caption}>{badge.earned ? `Earned ${formatDate(badge.earnedAt)}` : badge.requirement}</Text>
              {!badge.earned ? (
                <>
                  <ProgressBar percentage={badge.progress?.percentage || 0} />
                  <Text style={styles.caption}>{badge.progress?.label || 'No eligible activity yet'}</Text>
                </>
              ) : null}
            </AdminCard>
          )) : (
            <AdminCard style={styles.achievement}>
              <Text style={styles.caption}>Achievement records are not available yet.</Text>
            </AdminCard>
          )}
          <AdminSectionTitle hint="Recommendations are based on this student's latest published-lesson assessments.">
            Recommended lessons to review
          </AdminSectionTitle>
          {(data.recommendations || []).length ? data.recommendations.map((item) => (
            <AdminCard key={item.lessonId} style={styles.recommendation}>
              <Text style={styles.subjectCode}>{item.subjectCode} · {item.subjectName}</Text>
              <Text style={styles.subjectName}>Lesson {item.lessonNumber}: {item.lessonTitle}</Text>
              <Text style={styles.caption}>{item.reason}</Text>
            </AdminCard>
          )) : (
            <AdminCard style={styles.recommendation}>
              <Text style={styles.caption}>
                {data.recommendationsEmptyReason === 'no_assessment_history'
                  ? 'No assessment history is available for recommendations yet.'
                  : data.recommendationsEmptyReason === 'assessment_data_incomplete'
                    ? 'Some assessment records are incomplete, so recommendations could not be calculated safely.'
                    : 'No lessons currently need review based on the latest assessment results.'}
              </Text>
            </AdminCard>
          )}
          <LearningReportSection
            report={data.learningReport}
            admin
            onRetry={() => setReload((n) => n + 1)}
            onOpenWritingSubmission={(submissionId) => navigation.navigate('AdminWritingSubmissionDetail', {
              adminUserId: userId,
              userName: data.student?.name,
              submissionId,
            })}
          />
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
  achievement: { gap: 9, padding: 13 },
  achievementEarned: { backgroundColor: colors.greenLight, borderColor: '#D8E8DC' },
  achievementLocked: { opacity: 0.82 },
  achievementRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  achievementIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  achievementIconEarned: { backgroundColor: '#D5E8D9' },
  achievementIconLocked: { backgroundColor: '#EEF0EC' },
  recommendation: { gap: 6, padding: 14 },
});
