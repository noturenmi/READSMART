import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Screen } from '../components/Screen';
import { ReadingState } from '../components/ReadingComponents';
import { api } from '../services/api';
import { LearningReportSection } from '../components/LearningReportSection';
import { colors } from '../theme';

export function ProgressScreen({ navigation }) {
  const [progress, setProgress] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [badges, setBadges] = useState([]);
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState('');
  const [badgesLoading, setBadgesLoading] = useState(true);
  const [badgesError, setBadgesError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError('');
    setBadgesLoading(true);
    setBadgesError(false);
    setReportLoading(true);
    setReportError('');
    api.getLearningReport()
      .then((result) => {
        if (!active) return;
        setReport(result);
        setProgress(result.progress);
        setSubjects(Array.isArray(result.subjects) ? result.subjects : []);
      })
      .catch(async (requestError) => {
        if (!active) return;
        setReportError(requestError.message || 'Unable to load your learning report. Please try again.');
        try {
          const [myProgress, subjectData] = await Promise.all([api.getMyProgress(), api.getSubjectProgress()]);
          if (!active) return;
          setProgress(myProgress);
          setSubjects(Array.isArray(subjectData.subjects) ? subjectData.subjects : []);
        } catch (progressError) {
          if (active) setError(progressError.message || 'Unable to load your progress. Please try again.');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setReportLoading(false);
        }
      });
    api.getMyAchievements()
      .then((result) => { if (active) setBadges(Array.isArray(result.badges) ? result.badges : []); })
      .catch(() => { if (active) setBadgesError(true); })
      .finally(() => { if (active) setBadgesLoading(false); });
    return () => { active = false; };
  }, [reload]));

  return (
    <Screen>
      <View>
        <Text style={styles.eyebrow}>YOUR LEARNING JOURNEY</Text>
        <Text style={styles.title}>My Progress</Text>
        <Text style={styles.subtitle}>See the steady steps you take as you learn.</Text>
      </View>

      {loading ? <ReadingState kind="loading" title="Loading your progress…" /> : null}
      {!loading && error ? (
        <ReadingState
          kind="error"
          title="Unable to load your progress."
          message={error}
          onRetry={() => setReload((value) => value + 1)}
        />
      ) : null}
      {!loading && !error && progress ? (
        <>
          <Card style={styles.levelCard}>
            <View style={styles.levelTop}>
              <View style={styles.levelIcon}><Ionicons name="leaf-outline" size={21} color={colors.greenDark} /></View>
              <View style={styles.levelCopy}>
                <Text style={styles.levelLabel}>CURRENT LEVEL</Text>
                <Text style={styles.levelName}>Level {progress.level}</Text>
              </View>
              <Text style={styles.xp}>{progress.totalXP} XP</Text>
            </View>
            <ProgressBar percentage={progress.levelProgressPercentage} label="Progress to next level" />
            <Text style={styles.progressCopy}>
              {progress.totalXP} / {progress.nextLevelXP} XP · Level {progress.level + 1} starts at {progress.nextLevelXP} XP
            </Text>
          </Card>

          <View style={styles.metrics}>
            <Metric label="Reading assessments" value={`${progress.readingAssessmentsCompleted} / ${progress.totalReadingAssessments}`} icon="checkmark-done-outline" />
            <Metric label="Writing activities" value={`${progress.writingActivitiesCompleted} / ${progress.totalWritingActivities}`} icon="create-outline" />
            <Metric label="Lessons completed" value={`${progress.lessonsCompleted} / ${progress.totalLessons}`} icon="book-outline" />
          </View>

          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Progress by Subject</Text>
            <Text style={styles.sectionHint}>A lesson counts when you complete a reading assessment or writing activity.</Text>
          </View>
          {subjects.length ? subjects.map((subject) => (
            <Card key={subject.subjectId} style={styles.subjectCard}>
              <View style={styles.subjectTop}>
                <View style={styles.subjectText}>
                  <Text style={styles.subjectCode}>{subject.subjectCode}</Text>
                  <Text style={styles.subjectName}>{subject.subjectName}</Text>
                  <Text style={styles.subjectCount}>{subject.completedLessons} / {subject.totalLessons} lessons completed</Text>
                </View>
                <Text style={styles.subjectPercentage}>{subject.percentage}%</Text>
              </View>
              <ProgressBar percentage={subject.percentage} label={`${subject.subjectName} progress`} />
              <View style={styles.subjectActivity}>
                <Text style={styles.subjectActivityText}>
                  Reading assessments: {subject.completedReadingAssessments} / {subject.totalReadingAssessments}
                </Text>
                <Text style={styles.subjectActivityText}>
                  Writing activities: {subject.completedWritingActivities} / {subject.totalWritingActivities}
                </Text>
              </View>
              <Text style={styles.subjectXP}>{subject.totalXP} XP earned in this subject</Text>
            </Card>
          )) : (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No subjects are available yet.</Text>
              <Text style={styles.emptyText}>Your subject progress will appear here when lessons are available.</Text>
            </Card>
          )}

          <LearningReportSection
            report={report}
            loading={reportLoading}
            error={reportError}
            onRetry={() => setReload((value) => value + 1)}
            onOpenWritingSubmission={(submissionId) => navigation.navigate('Writing', {
              screen: 'WritingSubmissionDetail',
              params: { submissionId },
            })}
          />

          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Recent Learning Activities</Text>
            {progress.lastActivityAt ? <Text style={styles.sectionHint}>Last activity: {formatDate(progress.lastActivityAt)}</Text> : null}
          </View>
          {progress.recentActivities?.length ? progress.recentActivities.map((activity) => (
            <Card key={activity.id} style={styles.activityCard}>
              <View style={styles.activityIcon}>
                <Ionicons
                  name={activity.activityType === 'writing_activity' ? 'create-outline' : 'checkmark-done-outline'}
                  size={18}
                  color={colors.greenDark}
                />
              </View>
              <View style={styles.activityCopy}>
                <Text style={styles.activityTitle}>{activity.title}</Text>
                <Text style={styles.activityLesson}>
                  {activity.lesson ? `Lesson ${activity.lesson.lessonNumber}: ${activity.lesson.title}` : 'Completed lesson'}
                </Text>
              </View>
              <Text style={styles.activityXP}>+{activity.xpEarned} XP</Text>
            </Card>
          )) : (
            <Card style={styles.emptyCard}>
              <Ionicons name="trending-up-outline" size={23} color={colors.green} />
              <Text style={styles.emptyTitle}>Your progress starts with a lesson</Text>
              <Text style={styles.emptyText}>Complete a reading assessment or writing activity to earn XP.</Text>
            </Card>
          )}

          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>My Achievements</Text>
            <Text style={styles.sectionHint}>Badges are earned through completed assessments and writing activities.</Text>
          </View>
          {badgesLoading ? <ReadingState kind="loading" title="Loading achievements…" /> : null}
          {!badgesLoading && badgesError ? (
            <ReadingState
              kind="error"
              title="Unable to load achievements."
              message="Your progress is still available. Please try again."
              onRetry={() => setReload((value) => value + 1)}
            />
          ) : null}
          {!badgesLoading && !badgesError && badges.length ? badges.map((badge) => (
            <Card
              key={badge.id}
              style={[styles.achievementCard, badge.earned ? styles.earnedBadge : styles.lockedBadge]}
            >
              <View style={styles.achievementTop}>
                <View style={[styles.achievementIcon, badge.earned ? styles.earnedIcon : styles.lockedIcon]}>
                  <Ionicons name={badge.icon || 'ribbon-outline'} size={20} color={badge.earned ? colors.greenDark : colors.muted} />
                </View>
                <View style={styles.achievementCopy}>
                  <View style={styles.achievementTitleRow}>
                    <Text style={styles.achievementName}>{badge.name}</Text>
                    <Text style={[styles.badgeStatus, badge.earned ? styles.earnedStatus : styles.lockedStatus]}>
                      {badge.earned ? 'EARNED' : 'LOCKED'}
                    </Text>
                  </View>
                  <Text style={styles.achievementDescription}>{badge.description}</Text>
                </View>
              </View>
              {badge.earned ? (
                <Text style={styles.achievementProgress}>Earned {formatDate(badge.earnedAt)}</Text>
              ) : (
                <>
                  <Text style={styles.achievementProgress}>{badge.progress?.label || badge.requirement}</Text>
                  <ProgressBar percentage={badge.progress?.percentage || 0} label={`${badge.name} achievement progress`} />
                  <Text style={styles.achievementRequirement}>{badge.requirement}</Text>
                </>
              )}
            </Card>
          )) : null}
          {!badgesLoading && !badgesError && !badges.length ? (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Achievements are not available yet.</Text>
              <Text style={styles.emptyText}>Try again after your learning records are ready.</Text>
            </Card>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function Metric({ label, value, icon }) {
  return (
    <Card style={styles.metric}>
      <Ionicons name={icon} size={18} color={colors.green} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </Card>
  );
}

function ProgressBar({ percentage, label }) {
  const safePercentage = Math.min(100, Math.max(0, Number(percentage) || 0));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: safePercentage }}
      style={styles.track}
    >
      <View style={[styles.fill, { width: `${safePercentage}%` }]} />
    </View>
  );
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.green, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.ink, fontSize: 25, fontWeight: '800', marginTop: 6 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 5 },
  levelCard: { backgroundColor: colors.greenLight, borderColor: '#D8E8DC', gap: 10 },
  levelTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  levelIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: '#D5E8D9', alignItems: 'center', justifyContent: 'center' },
  levelCopy: { flex: 1 },
  levelLabel: { color: colors.green, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  levelName: { color: colors.greenDark, fontSize: 18, fontWeight: '800', marginTop: 3 },
  xp: { color: colors.greenDark, fontWeight: '800', fontSize: 15 },
  track: { height: 9, borderRadius: 5, backgroundColor: '#D5E4D8', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5, backgroundColor: colors.green },
  progressCopy: { color: '#587063', fontSize: 11, lineHeight: 17 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { flexGrow: 1, flexBasis: '30%', minWidth: 95, padding: 13 },
  metricValue: { color: colors.ink, fontWeight: '800', fontSize: 18, marginTop: 8 },
  metricLabel: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  sectionHeading: { gap: 4, marginTop: 1 },
  sectionTitle: { color: colors.greenDark, fontSize: 17, fontWeight: '800' },
  sectionHint: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  subjectCard: { gap: 10, padding: 15 },
  subjectTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  subjectText: { flex: 1, minWidth: 0 },
  subjectCode: { color: colors.green, fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
  subjectName: { color: colors.ink, fontSize: 14, lineHeight: 20, fontWeight: '700', flexShrink: 1 },
  subjectCount: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  subjectPercentage: { color: colors.greenDark, fontSize: 13, fontWeight: '800' },
  subjectActivity: { gap: 3 },
  subjectActivityText: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  subjectXP: { color: colors.greenDark, fontSize: 12, fontWeight: '700' },
  activityCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13 },
  activityIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.greenLight },
  activityCopy: { flex: 1, minWidth: 0 },
  activityTitle: { color: colors.ink, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  activityLesson: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  activityXP: { color: colors.greenDark, fontSize: 12, fontWeight: '800' },
  achievementCard: { gap: 10, padding: 14 },
  earnedBadge: { backgroundColor: colors.greenLight, borderColor: '#D8E8DC' },
  lockedBadge: { backgroundColor: colors.surface, opacity: 0.82 },
  achievementTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  achievementIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  earnedIcon: { backgroundColor: '#D5E8D9' },
  lockedIcon: { backgroundColor: '#EEF0EC' },
  achievementCopy: { flex: 1, minWidth: 0, gap: 4 },
  achievementTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7 },
  achievementName: { flex: 1, color: colors.ink, fontSize: 14, lineHeight: 19, fontWeight: '800' },
  badgeStatus: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  earnedStatus: { color: colors.green },
  lockedStatus: { color: colors.muted },
  achievementDescription: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  achievementProgress: { color: colors.greenDark, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  achievementRequirement: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  emptyCard: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  emptyTitle: { color: colors.ink, fontWeight: '700', fontSize: 14, textAlign: 'center' },
  emptyText: { color: colors.muted, textAlign: 'center', fontSize: 12, lineHeight: 18 },
});
