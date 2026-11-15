import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { ReadingState } from '../components/ReadingComponents';
import { AdminCard, AdminHeader } from '../components/AdminComponents';
import { api } from '../services/api';
import { colors } from '../theme';

const periods = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'allTime', label: 'All Time' },
];
const tiles = [
  ['totalStudents', 'Total Students', 'people-outline'],
  ['activeLearners', 'Active Learners', 'pulse-outline'],
  ['completedReadingLessons', 'Completed Reading Lessons', 'book-outline'],
  ['completedAssessments', 'Completed Assessments', 'checkmark-done-outline'],
  ['completedWritingActivities', 'Completed Writing Activities', 'create-outline'],
];

function periodName(period) { return periods.find((item) => item.key === period)?.label || 'Weekly'; }

export function AdminLearningAnalyticsScreen({ navigation }) {
  const [period, setPeriod] = useState('weekly');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const hasPeriodActivity = Boolean(report?.summary && (
    report.summary.activeLearners > 0
    || report.summary.completedReadingLessons > 0
    || report.summary.completedAssessments > 0
    || report.summary.completedWritingActivities > 0
  ));

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError(false);
    api.adminGetLearningAnalytics(period)
      .then((data) => { if (active) setReport(data); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [period, reload]));

  return (
    <Screen>
      <AdminHeader title="Learning Analytics" subtitle="Aggregated student activity and assessment performance." onBack={() => navigation.goBack()} />
      <View style={styles.filterHeader}>
        <Text style={styles.filterTitle}>Reporting period</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Refresh analytics" onPress={() => setReload((value) => value + 1)} style={styles.refresh}>
          <Ionicons name="refresh-outline" size={18} color={colors.greenDark} />
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periods}>
        {periods.map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityState={{ selected: period === item.key }}
            onPress={() => setPeriod(item.key)}
            style={[styles.periodButton, period === item.key && styles.periodButtonSelected]}
          >
            <Text style={[styles.periodText, period === item.key && styles.periodTextSelected]}>{item.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={styles.timezone}>Period counts use the {report?.timeZone || 'Asia/Manila'} calendar.</Text>

      {loading ? <ReadingState kind="loading" title="Loading learning analytics…" /> : null}
      {!loading && error ? <ReadingState kind="error" title="Unable to load analytics." message="Check the server connection and try again." onRetry={() => setReload((value) => value + 1)} /> : null}
      {!loading && !error && report ? (
        <>
          <View style={styles.stats}>
            {tiles.map(([key, label, icon]) => (
              <AdminCard key={key} style={styles.stat}>
                <Ionicons name={icon} size={19} color={colors.green} />
                <Text style={styles.statValue}>{report.summary[key] ?? 0}</Text>
                <Text style={styles.statLabel}>{label}</Text>
                {key !== 'totalStudents' ? <Text style={styles.statPeriod}>{periodName(report.period)}</Text> : null}
              </AdminCard>
            ))}
          </View>

          <View style={styles.averageRow}>
            <AverageCard label="Average comprehension score" value={report.summary.averageComprehensionScore} />
            <AverageCard label="Average writing assessment score" value={report.summary.averageWritingScore} />
          </View>
          <Text style={styles.metricNote}>Scores are percentages from submitted attempts and writing rubrics; averages include repeated submissions.</Text>

          {hasPeriodActivity && report.trends.length ? (
            <>
              <TrendChart title="Learning activity over time" subtitle="Assessment submissions and unique completed lessons/activities." trends={report.trends} mode="activity" />
              <TrendChart title="Average performance over time" subtitle="Mean score by submission date; percentage scale 0–100." trends={report.trends} mode="scores" />
            </>
          ) : (
            <AdminCard style={styles.emptyCard}>
              <Ionicons name="bar-chart-outline" size={25} color={colors.muted} />
              <Text style={styles.emptyTitle}>No learning activity recorded yet.</Text>
              <Text style={styles.emptyText}>Analytics and performance trends will appear when students submit assessments or writing activities.</Text>
            </AdminCard>
          )}

          <View style={styles.subjectHeading}>
            <Text style={styles.sectionTitle}>Subject performance</Text>
            <Text style={styles.sectionHint}>Based on existing lesson and assessment records for {periodName(report.period).toLowerCase()}.</Text>
          </View>
          {report.subjects.length ? report.subjects.map((subject) => (
            <AdminCard key={subject.subjectId} style={styles.subjectCard}>
              <View style={styles.subjectTitleRow}>
                <Text style={styles.subjectCode}>{subject.subjectCode}</Text>
                <Text style={styles.subjectName}>{subject.subjectName}</Text>
              </View>
              <View style={styles.subjectMetrics}>
                <SubjectMetric label="Completed lessons" value={subject.completedLessons} />
                <SubjectMetric label="Assessments submitted" value={subject.completedAssessments} />
                <SubjectMetric label="Average score" value={subject.averageAssessmentScore == null ? '—' : `${subject.averageAssessmentScore}%`} />
              </View>
            </AdminCard>
          )) : <ReadingState kind="empty" title="No subjects are available." />}
          <Text style={styles.footnote}>Completed lessons count a student and lesson once in the selected period, based on a saved assessment attempt or writing submission. Opening a lesson is not counted.</Text>
        </>
      ) : null}
    </Screen>
  );
}

function AverageCard({ label, value }) {
  return (
    <AdminCard style={styles.averageCard}>
      <Text style={styles.averageLabel}>{label}</Text>
      <Text style={styles.averageValue}>{value == null ? 'No score data' : `${value}%`}</Text>
      <Text style={styles.averageScale}>Percentage scale</Text>
    </AdminCard>
  );
}

function SubjectMetric({ label, value }) {
  return <View style={styles.subjectMetric}><Text style={styles.subjectMetricValue}>{value}</Text><Text style={styles.subjectMetricLabel}>{label}</Text></View>;
}

function TrendChart({ title, subtitle, trends, mode }) {
  const activitySeries = [
    { key: 'completedAssessments', label: 'Assessment submissions', color: colors.green },
    { key: 'completedReadingLessons', label: 'Completed lessons', color: colors.blue },
    { key: 'completedWritingActivities', label: 'Writing activities', color: colors.gold },
  ];
  const scoreSeries = [
    { key: 'averageComprehensionScore', label: 'Comprehension', color: colors.green },
    { key: 'averageWritingScore', label: 'Writing', color: colors.blue },
  ];
  const series = mode === 'activity' ? activitySeries : scoreSeries;
  const maxValue = mode === 'scores' ? 100 : Math.max(1, ...trends.flatMap((point) => series.map(({ key }) => point[key] || 0)));
  const chartHeight = 112;
  return (
    <AdminCard style={styles.chartCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionHint}>{subtitle}</Text>
      <Text style={styles.axisLabel}>{mode === 'scores' ? 'Score (%)' : 'Number of activities'}</Text>
      <View style={styles.chartRow}>
        <View style={[styles.yAxis, { height: chartHeight }]}><Text style={styles.axisTick}>{maxValue}</Text><Text style={styles.axisTick}>0</Text></View>
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.chartScroll}>
          {trends.map((point) => (
            <View key={point.key} style={styles.chartPoint}>
              <View style={[styles.bars, { height: chartHeight }]}>
                {series.map((item) => {
                  const rawValue = point[item.key];
                  const value = Number.isFinite(rawValue) ? rawValue : 0;
                  const height = value > 0 ? Math.max(3, (value / maxValue) * chartHeight) : 0;
                  return (
                    <View key={item.key} style={styles.barCell}>
                      {value > 0 ? <Text style={styles.barValue}>{mode === 'scores' ? `${value}%` : value}</Text> : null}
                      <View style={[styles.bar, { height, backgroundColor: item.color }]} />
                    </View>
                  );
                })}
              </View>
              <Text style={styles.xAxisLabel}>{point.label}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
      <View style={styles.legend}>
        {series.map((item) => <View key={item.key} style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: item.color }]} /><Text style={styles.legendText}>{item.label}</Text></View>)}
      </View>
    </AdminCard>
  );
}

const styles = StyleSheet.create({
  filterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  filterTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  refresh: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, borderRadius: 10, backgroundColor: colors.greenLight },
  refreshText: { color: colors.greenDark, fontSize: 11, fontWeight: '800' },
  periods: { gap: 7, paddingVertical: 2 },
  periodButton: { minHeight: 37, justifyContent: 'center', paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  periodButtonSelected: { borderColor: colors.green, backgroundColor: colors.green },
  periodText: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  periodTextSelected: { color: '#FFFFFF' },
  timezone: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { flexBasis: '30%', flexGrow: 1, minWidth: 96, minHeight: 106, padding: 11, gap: 5 },
  statValue: { color: colors.ink, fontSize: 20, lineHeight: 25, fontWeight: '800' },
  statLabel: { color: colors.muted, fontSize: 10, lineHeight: 14, fontWeight: '700' },
  statPeriod: { color: colors.greenDark, fontSize: 9, lineHeight: 12 },
  averageRow: { flexDirection: 'row', gap: 8 },
  averageCard: { flex: 1, minWidth: 0, gap: 7, padding: 12, backgroundColor: colors.greenLight, borderColor: '#D8E8DC' },
  averageLabel: { color: colors.greenDark, fontSize: 10, lineHeight: 15, fontWeight: '700' },
  averageValue: { color: colors.ink, fontSize: 17, lineHeight: 22, fontWeight: '800' },
  averageScale: { color: colors.muted, fontSize: 9, lineHeight: 13 },
  metricNote: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: -10 },
  chartCard: { gap: 8, paddingHorizontal: 12 },
  sectionTitle: { color: colors.greenDark, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  sectionHint: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  axisLabel: { color: colors.muted, fontSize: 9, lineHeight: 13 },
  chartRow: { flexDirection: 'row', gap: 5 },
  yAxis: { justifyContent: 'space-between', paddingBottom: 17 },
  axisTick: { color: colors.muted, fontSize: 9 },
  chartScroll: { alignItems: 'flex-end', gap: 6, paddingRight: 4 },
  chartPoint: { width: 42, alignItems: 'center', justifyContent: 'flex-end' },
  bars: { width: '100%', flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 2, borderBottomWidth: 1, borderBottomColor: colors.border },
  barCell: { height: '100%', flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '78%', minHeight: 0, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  barValue: { color: colors.muted, fontSize: 7, lineHeight: 9, marginBottom: 2 },
  xAxisLabel: { color: colors.muted, fontSize: 8, lineHeight: 13, marginTop: 3 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { color: colors.muted, fontSize: 9, lineHeight: 13 },
  subjectHeading: { gap: 3, marginTop: 2 },
  subjectCard: { gap: 11 },
  subjectTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  subjectCode: { color: colors.greenDark, fontSize: 11, lineHeight: 16, fontWeight: '900' },
  subjectName: { flex: 1, minWidth: 0, color: colors.ink, fontSize: 12, lineHeight: 17, fontWeight: '800' },
  subjectMetrics: { flexDirection: 'row', gap: 8 },
  subjectMetric: { flex: 1, minWidth: 0 },
  subjectMetricValue: { color: colors.ink, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  subjectMetricLabel: { color: colors.muted, fontSize: 9, lineHeight: 13 },
  footnote: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  emptyCard: { alignItems: 'center', gap: 8, paddingVertical: 22 },
  emptyTitle: { color: colors.ink, fontSize: 13, lineHeight: 18, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center' },
});
