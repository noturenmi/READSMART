import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Screen';
import { AdminCard } from './AdminComponents';
import { ReadingState } from './ReadingComponents';
import { colors } from '../theme';

const rubricLabels = [
  ['grammar', 'Grammar'],
  ['vocabulary', 'Vocabulary'],
  ['organization', 'Organization'],
  ['coherence', 'Coherence'],
  ['developmentOfIdeas', 'Development'],
];

function formatDate(value) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString();
}

function dateNote(value, source) {
  return source === 'createdAt' ? `${formatDate(value)} · recorded date` : formatDate(value);
}

function changeLabel(change) {
  if (!change) return null;
  const verb = change.status === 'increased' ? 'increased' : change.status === 'decreased' ? 'decreased' : 'stayed the same';
  const rawDelta = change.scoreDelta > 0 ? `+${change.scoreDelta}` : String(change.scoreDelta);
  const percentageDelta = change.percentagePointDelta > 0
    ? `+${change.percentagePointDelta}`
    : String(change.percentagePointDelta);
  return `Recorded score ${verb}: ${rawDelta} points (${percentageDelta} percentage points) since the previous comparable result.`;
}

export function LearningReportSection({
  report,
  loading = false,
  error = '',
  onRetry,
  onOpenWritingSubmission,
  admin = false,
}) {
  const ReportCard = admin ? AdminCard : Card;
  if (loading) return <ReadingState kind="loading" title="Loading learning report…" />;
  if (error) {
    return (
      <ReadingState
        kind="error"
        title="Unable to load the learning report."
        message={error}
        onRetry={onRetry}
      />
    );
  }
  if (!report) return null;

  const readingResults = report.reading?.results || [];
  const writingSubmissions = report.writing?.submissions || [];
  const subjectRows = report.subjects || [];
  const unmatchedReadingResults = readingResults.filter((result) => result.resultAvailable && !result.comparisonAvailable).slice(0, 6);
  const subjectLatest = new Map();
  for (const result of readingResults) {
    const subjectId = result.lesson?.subject?.id;
    if (subjectId && result.resultAvailable && !subjectLatest.has(subjectId)) subjectLatest.set(subjectId, result);
  }
  const hasHistory = report.summary?.readingAssessmentCount > 0 || report.summary?.writingSubmissionCount > 0;

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text style={styles.title}>Learning Improvement Report</Text>
        <Text style={styles.subtitle}>Recorded results over time, using only comparable assessments.</Text>
      </View>

      <ReportCard style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Learning summary</Text>
        <View style={styles.summaryGrid}>
          <SummaryMetric label="Reading assessments completed" value={`${report.progress?.readingAssessmentsCompleted ?? 0} / ${report.progress?.totalReadingAssessments ?? 0}`} />
          <SummaryMetric label="Writing activities completed" value={`${report.progress?.writingActivitiesCompleted ?? 0} / ${report.progress?.totalWritingActivities ?? 0}`} />
          <SummaryMetric label="Lessons completed" value={`${report.summary?.lessonsCompleted ?? 0} / ${report.summary?.totalLessons ?? 0}`} />
          <SummaryMetric label="Overall progress" value={`${report.summary?.overallProgressPercentage ?? 0}%`} />
        </View>
        {report.summary?.latestReading ? (
          <Text style={styles.summaryLine}>
            Latest reading result: {report.summary.latestReading.score.raw} / {report.summary.latestReading.score.totalPoints} points ({report.summary.latestReading.score.percentage}%) · {report.summary.latestReading.lesson?.subject?.code || 'Subject'} · {report.summary.latestReading.lesson?.title || 'Lesson'}
          </Text>
        ) : null}
        {report.summary?.latestWriting ? (
          <Text style={styles.summaryLine}>
            Latest writing result: {report.summary.latestWriting.score.raw} / {report.summary.latestWriting.score.maxScore} rubric points ({report.summary.latestWriting.score.percentage}%) · {report.summary.latestWriting.writingActivity?.title || 'Writing activity'}
          </Text>
        ) : null}
      </ReportCard>

      {!hasHistory ? (
        <ReportCard style={styles.emptyCard}>
          <Ionicons name="bar-chart-outline" size={24} color={colors.green} />
          <Text style={styles.cardTitle}>No learning history yet</Text>
          <Text style={styles.body}>Complete a reading assessment or writing activity to see your results here.</Text>
        </ReportCard>
      ) : null}

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Performance by Subject</Text>
        <Text style={styles.body}>Subject progress uses completed activities. Reading scores remain tied to their lesson and are not averaged across different assessments.</Text>
      </View>
      {subjectRows.length ? subjectRows.map((subject) => {
        const latest = subjectLatest.get(subject.subjectId);
        return (
          <ReportCard key={subject.subjectId} style={styles.subjectCard}>
            <View style={styles.subjectTop}>
              <View style={styles.subjectCopy}>
                <Text style={styles.subjectCode}>{subject.subjectCode}</Text>
                <Text style={styles.cardTitle}>{subject.subjectName}</Text>
              </View>
              <Text style={styles.subjectPercent}>{subject.percentage}%</Text>
            </View>
            <ProgressBar percentage={subject.percentage} label={`${subject.subjectName} progress`} />
            <Text style={styles.body}>{subject.completedLessons} / {subject.totalLessons} lessons completed · {subject.completedReadingAssessments} reading assessments · {subject.completedWritingActivities} writing activities</Text>
            {latest ? (
              <Text style={styles.subjectScore}>
                Latest recorded reading score: {latest.score.raw} / {latest.score.totalPoints} points ({latest.score.percentage}%) · {latest.lesson.title}
              </Text>
            ) : <Text style={styles.body}>No complete reading assessment result recorded for this subject.</Text>}
          </ReportCard>
        );
      }) : (
        <ReportCard><Text style={styles.body}>Subject progress is not available yet.</Text></ReportCard>
      )}

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Reading assessment history</Text>
        <Text style={styles.body}>Scores are compared only when they belong to the same lesson, use the same point scale, and have an identical saved question set.</Text>
      </View>
      {report.reading?.trends?.length ? report.reading.trends.map((trend) => (
        <ReportCard key={`${trend.lesson?.id}-${trend.comparability}`} style={styles.historyCard}>
          <Text style={styles.subjectCode}>{trend.lesson?.subject?.code || 'Reading'}</Text>
          <Text style={styles.cardTitle}>{trend.lesson?.title || 'Lesson unavailable'}</Text>
          <Text style={styles.body}>{trend.attemptCount} comparable attempt{trend.attemptCount === 1 ? '' : 's'} · scale: {trend.scale.totalPoints} points across {trend.scale.totalItems} questions</Text>
          {trend.attempts.map((attempt) => (
            <View key={attempt.id} style={styles.resultRow}>
              <Text style={styles.date}>{dateNote(attempt.submittedAt, attempt.timestampSource)}</Text>
              <Text style={styles.score}>{attempt.score} / {attempt.totalPoints} · {attempt.percentage}%</Text>
            </View>
          ))}
          {trend.omittedAttemptCount ? <Text style={styles.body}>{trend.omittedAttemptCount} older attempts are not shown.</Text> : null}
          {trend.change ? <Text style={styles.change}>{changeLabel(trend.change)}</Text> : <Text style={styles.body}>Complete another assessment on this same lesson and question set to see a score comparison.</Text>}
        </ReportCard>
      )) : (
        <ReportCard style={styles.emptyCard}>
          <Text style={styles.body}>
            {report.summary?.readingAssessmentCount
              ? 'Assessment history exists, but there are not enough complete, timestamped results with a stable question set and scoring scale to compare safely.'
              : 'Complete more assessments to see your performance trend.'}
          </Text>
        </ReportCard>
      )}
      {report.reading?.historyTruncated ? <Text style={styles.body}>Showing the latest {readingResults.length} reading records.</Text> : null}
      {report.reading?.excludedFromComparisonCount > 0 ? (
        <>
          <Text style={styles.body}>{report.reading.excludedFromComparisonCount} recorded attempt(s) are excluded from trends because their result, timestamp, lesson, saved question details, or scoring scale is incomplete or incompatible.</Text>
          {unmatchedReadingResults.map((result) => (
            <ReportCard key={`raw-${result.id}`} style={styles.historyCard}>
              <Text style={styles.subjectCode}>{result.lesson?.subject?.code || 'Reading'} · raw result, not compared</Text>
              <Text style={styles.cardTitle}>{result.lesson?.title || 'Lesson details unavailable'}</Text>
              <View style={styles.resultRow}>
                <Text style={styles.date}>{dateNote(result.submittedAt, result.timestampSource)}</Text>
                <Text style={styles.score}>{result.score.raw} / {result.score.totalPoints} points · {result.score.percentage}%</Text>
              </View>
            </ReportCard>
          ))}
          {unmatchedReadingResults.length < report.reading.excludedFromComparisonCount
            ? <Text style={styles.body}>Only complete raw results are shown here; incomplete records are not presented as scores.</Text>
            : null}
        </>
      ) : null}

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Writing results</Text>
        <Text style={styles.body}>Rubric results use the existing 25-point scale. Writing scores are compared only for the same activity.</Text>
      </View>
      {report.writing?.trends?.length ? report.writing.trends.map((trend) => (
        <ReportCard key={`${trend.writingActivity.id}-${trend.comparability}`} style={styles.historyCard}>
          <Text style={styles.subjectCode}>{trend.lesson?.subject?.code || 'Writing'}</Text>
          <Text style={styles.cardTitle}>{trend.writingActivity.title}</Text>
          <Text style={styles.body}>{trend.lesson?.title || 'Lesson unavailable'} · {trend.submissionCount} comparable submission{trend.submissionCount === 1 ? '' : 's'} on the 25-point rubric</Text>
          {trend.submissions.map((submission) => (
            <View key={submission.id} style={styles.resultRow}>
              <Text style={styles.date}>{dateNote(submission.submittedAt, submission.timestampSource)}</Text>
              <Text style={styles.score}>{submission.score} / {submission.maxScore} rubric points · {submission.percentage}%</Text>
            </View>
          ))}
          {trend.omittedSubmissionCount ? <Text style={styles.body}>{trend.omittedSubmissionCount} older submissions are not shown.</Text> : null}
          {trend.change ? <Text style={styles.change}>{changeLabel(trend.change)}</Text> : <Text style={styles.body}>Complete this activity again to compare rubric results over time.</Text>}
        </ReportCard>
      )) : (
        <ReportCard style={styles.emptyCard}>
          <Text style={styles.body}>
            {report.summary?.writingSubmissionCount
              ? 'Writing records exist, but there are not enough complete, timestamped results on the same rubric to compare safely.'
              : 'Writing assessment history will appear after you submit a writing activity.'}
          </Text>
        </ReportCard>
      )}

      {writingSubmissions.length ? (
        <>
          <Text style={styles.sectionTitle}>Recent writing submissions</Text>
          {writingSubmissions.map((submission) => (
            <ReportCard key={submission.id} style={styles.historyCard}>
              <Text style={styles.cardTitle}>{submission.writingActivity?.title || 'Writing activity unavailable'}</Text>
              <Text style={styles.body}>{submission.lesson?.subject?.code || 'Subject'} · {submission.lesson?.title || 'Lesson unavailable'} · {dateNote(submission.submittedAt, submission.timestampSource)}</Text>
              {submission.resultAvailable ? (
                <>
                  <Text style={styles.score}>{submission.score.raw} / {submission.score.maxScore} rubric points · {submission.score.percentage}%</Text>
                  <Text style={styles.body}>{rubricLabels.map(([key, label]) => `${label} ${submission.score.rubricScores[key]}/5`).join(' · ')}</Text>
                  {submission.score.feedback ? <Text style={styles.feedback} numberOfLines={3}>{submission.score.feedback}</Text> : null}
                  {!submission.comparisonAvailable ? <Text style={styles.body}>Score shown as recorded; excluded from trend comparisons.</Text> : null}
                </>
              ) : <Text style={styles.body}>Saved submission; assessment result is unavailable.</Text>}
              {submission.responsePreview ? <Text style={styles.preview} numberOfLines={3}>{submission.responsePreview}</Text> : null}
              {onOpenWritingSubmission ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open saved writing submission ${submission.writingActivity?.title || ''}`}
                  onPress={() => onOpenWritingSubmission(submission.id)}
                  style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
                >
                  <Text style={styles.linkText}>Open submission details</Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.greenDark} />
                </Pressable>
              ) : null}
            </ReportCard>
          ))}
          {report.writing?.historyDisplayTruncated ? <Text style={styles.body}>Showing the latest {writingSubmissions.length} writing submissions. Open writing history for the full list.</Text> : null}
        </>
      ) : null}

      <Text style={styles.disclaimer}>{report.comparisonNote}</Text>
    </View>
  );
}

function SummaryMetric({ label, value }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function ProgressBar({ percentage, label }) {
  const safePercentage = Math.min(100, Math.max(0, Number(percentage) || 0));
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: safePercentage }} style={styles.track}>
      <View style={[styles.fill, { width: `${safePercentage}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  heading: { gap: 4, marginTop: 2 },
  title: { color: colors.greenDark, fontSize: 18, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  summaryCard: { gap: 10, backgroundColor: colors.greenLight, borderColor: '#D8E8DC' },
  summaryTitle: { color: colors.greenDark, fontSize: 15, fontWeight: '800' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { flexGrow: 1, flexBasis: '40%', minWidth: 110, borderRadius: 12, backgroundColor: colors.surface, padding: 10, gap: 3 },
  metricValue: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  metricLabel: { color: colors.muted, fontSize: 10, lineHeight: 14 },
  summaryLine: { color: colors.greenDark, fontSize: 11, lineHeight: 17 },
  sectionHeading: { gap: 4, marginTop: 2 },
  sectionTitle: { color: colors.greenDark, fontSize: 16, fontWeight: '800' },
  body: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  subjectCard: { gap: 8, padding: 14 },
  subjectTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  subjectCopy: { flex: 1, minWidth: 0 },
  subjectCode: { color: colors.green, fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  cardTitle: { color: colors.ink, fontSize: 13, lineHeight: 19, fontWeight: '800' },
  subjectPercent: { color: colors.greenDark, fontSize: 13, fontWeight: '800' },
  subjectScore: { color: colors.greenDark, fontSize: 11, lineHeight: 17, fontWeight: '700' },
  historyCard: { gap: 8, padding: 14 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  date: { flex: 1, color: colors.muted, fontSize: 10, lineHeight: 15 },
  score: { color: colors.greenDark, fontSize: 11, lineHeight: 16, fontWeight: '800', flexShrink: 1, textAlign: 'right' },
  change: { color: colors.ink, fontSize: 11, lineHeight: 17, backgroundColor: colors.greenLight, borderRadius: 10, padding: 9 },
  feedback: { color: colors.greenDark, fontSize: 11, lineHeight: 17 },
  preview: { color: colors.ink, fontSize: 11, lineHeight: 17 },
  emptyCard: { gap: 8, alignItems: 'center', paddingVertical: 17 },
  linkButton: { minHeight: 40, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 11, backgroundColor: colors.greenLight },
  linkText: { color: colors.greenDark, fontSize: 11, fontWeight: '800' },
  pressed: { opacity: 0.75 },
  disclaimer: { color: colors.muted, fontSize: 10, lineHeight: 16 },
  track: { height: 8, borderRadius: 5, backgroundColor: '#D5E4D8', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5, backgroundColor: colors.green },
});
