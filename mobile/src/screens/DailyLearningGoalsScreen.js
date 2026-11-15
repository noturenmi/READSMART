import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Screen } from '../components/Screen';
import { ReadingHeader, ReadingState } from '../components/ReadingComponents';
import { api } from '../services/api';
import { colors } from '../theme';

const goalLabels = {
  readingLessons: 'Reading lessons',
  assessments: 'Reading assessments',
  writingActivities: 'Writing activities',
};
const categories = Object.keys(goalLabels);
const TIME_ZONE = 'Asia/Manila';

function formatDate(dateKey) {
  if (!dateKey) return '';
  return new Intl.DateTimeFormat('en-PH', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: TIME_ZONE,
  }).format(new Date(`${dateKey}T12:00:00.000Z`));
}

export function DailyLearningGoalsScreen({ navigation }) {
  const [dailyGoal, setDailyGoal] = useState(null);
  const [targets, setTargets] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [reload, setReload] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError('');
    setHistoryLoading(true);
    setHistoryError(false);
    setSaveMessage('');
    api.getDailyGoalsToday()
      .then((result) => {
        if (!active) return;
        setDailyGoal(result.dailyGoal);
        setTargets(result.dailyGoal.targets);
      })
      .catch((requestError) => { if (active) setError(requestError.message || 'Unable to load today’s goals.'); })
      .finally(() => { if (active) setLoading(false); });
    api.getDailyGoalHistory()
      .then((result) => { if (active) setHistory(result.records || []); })
      .catch(() => { if (active) setHistoryError(true); })
      .finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [reload]));

  const changed = useMemo(() => Boolean(dailyGoal && targets
    && categories.some((key) => targets[key] !== dailyGoal.targets[key])), [dailyGoal, targets]);
  const previousDays = dailyGoal ? history.filter(({ dateKey }) => dateKey !== dailyGoal.dateKey) : history;

  function changeTarget(key, amount) {
    setTargets((current) => ({ ...current, [key]: Math.max(1, Math.min(10, current[key] + amount)) }));
    setSaveMessage('');
  }

  async function saveTargets() {
    if (!changed || saving) return;
    setSaving(true);
    setError('');
    setSaveMessage('');
    try {
      const result = await api.updateDailyGoalTargets(targets);
      setDailyGoal(result.dailyGoal);
      setTargets(result.dailyGoal.targets);
      setSaveMessage('Today’s targets were saved.');
    } catch (requestError) {
      setError(requestError.message || 'Unable to save your daily goals. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <ReadingHeader title="Daily Learning Goals" subtitle="Choose a few learning targets for today." onBack={() => navigation.goBack()} />
      {loading ? <ReadingState kind="loading" title="Loading today’s goals…" /> : null}
      {!loading && error && !dailyGoal ? (
        <ReadingState kind="error" title="Unable to load daily goals." message={error} onRetry={() => setReload((value) => value + 1)} />
      ) : null}
      {!loading && dailyGoal ? (
        <>
          {error ? (
            <ReadingState kind="error" title="Could not save your targets." message={error} onRetry={() => setReload((value) => value + 1)} />
          ) : null}
          <Card style={styles.summaryCard}>
            <Text style={styles.dateLabel}>TODAY · {formatDate(dailyGoal.dateKey)}</Text>
            <View style={styles.summaryNumbers}>
              <SummaryNumber value={`${dailyGoal.completedGoals} / ${dailyGoal.totalGoals}`} label="Goals completed" />
              <SummaryNumber value={String(dailyGoal.remainingGoals)} label="Goals remaining" />
              <SummaryNumber value={`${dailyGoal.completionPercentage}%`} label="Daily completion" />
            </View>
            <ProgressBar percentage={dailyGoal.completionPercentage} label="Daily goal completion" />
            <Text style={styles.timeZoneNote}>Daily records use the Asia/Manila calendar day.</Text>
          </Card>

          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Today’s progress</Text>
            <Text style={styles.sectionHint}>A lesson counts once after its assessment or writing activity is submitted. Opening it alone does not count.</Text>
          </View>
          {dailyGoal.goals.map((goal) => (
            <Card key={goal.key} style={styles.goalCard}>
              <View style={styles.goalHeading}>
                <View style={[styles.goalIcon, goal.isComplete && styles.goalIconComplete]}>
                  <Ionicons name={iconFor(goal.key)} size={19} color={colors.greenDark} />
                </View>
                <View style={styles.goalCopy}>
                  <Text style={styles.goalTitle}>{goal.label}</Text>
                  <Text style={styles.goalCount}>{goal.completed} / {goal.target} completed</Text>
                </View>
                <Ionicons name={goal.isComplete ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={goal.isComplete ? colors.green : colors.border} />
              </View>
              <ProgressBar percentage={goal.percentage} label={`${goal.label} goal progress`} />
              <Text style={styles.remainingText}>
                {goal.isComplete ? 'Goal complete for today' : `${goal.remaining} ${goal.remaining === 1 ? 'activity' : 'activities'} remaining`}
              </Text>
              <View style={styles.targetEditor}>
                <Text style={styles.targetLabel}>Daily target</Text>
                <View style={styles.stepper}>
                  <StepButton label="Decrease target" symbol="−" disabled={targets?.[goal.key] <= 1 || saving} onPress={() => changeTarget(goal.key, -1)} />
                  <Text accessibilityLabel={`${targets?.[goal.key] || goal.target} ${goal.label} target`} style={styles.targetValue}>{targets?.[goal.key] || goal.target}</Text>
                  <StepButton label="Increase target" symbol="+" disabled={targets?.[goal.key] >= 10 || saving} onPress={() => changeTarget(goal.key, 1)} />
                </View>
              </View>
            </Card>
          ))}
          <Pressable
            accessibilityRole="button"
            disabled={!changed || saving}
            onPress={saveTargets}
            style={({ pressed }) => [styles.saveButton, (!changed || saving) && styles.saveButtonDisabled, pressed && styles.pressed]}
          >
            <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save today’s targets'}</Text>
          </Pressable>
          {saveMessage ? <Text accessibilityRole="alert" style={styles.successMessage}>{saveMessage}</Text> : null}

          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Daily goal history</Text>
            <Text style={styles.sectionHint}>Your previous days are kept with the targets you set.</Text>
          </View>
          {historyLoading ? <ReadingState kind="loading" title="Loading goal history…" /> : null}
          {!historyLoading && historyError ? (
            <ReadingState kind="error" title="Unable to load goal history." message="Today’s goals are still available. Try again." onRetry={() => setReload((value) => value + 1)} />
          ) : null}
          {!historyLoading && !historyError && previousDays.length === 0 ? (
            <ReadingState kind="empty" title="No previous goal days yet." message="Your completed daily goal records will appear here." />
          ) : null}
          {!historyLoading && !historyError ? previousDays.map((day) => (
            <HistoryCard key={day.dateKey} day={day} />
          )) : null}
        </>
      ) : null}
    </Screen>
  );
}

function SummaryNumber({ value, label }) {
  return (
    <View style={styles.summaryNumber}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function StepButton({ label, symbol, disabled, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.stepButton, disabled && styles.stepButtonDisabled, pressed && styles.pressed]}
    >
      <Text style={styles.stepSymbol}>{symbol}</Text>
    </Pressable>
  );
}

function HistoryCard({ day }) {
  return (
    <Card style={styles.historyCard}>
      <View style={styles.historyHeading}>
        <View style={styles.historyIcon}><Ionicons name="calendar-outline" size={18} color={colors.greenDark} /></View>
        <View style={styles.historyCopy}>
          <Text style={styles.historyDate}>{formatDate(day.dateKey)}</Text>
          <Text style={styles.historySummary}>{day.completedGoals} of {day.totalGoals} goals completed · {day.completionPercentage}%</Text>
        </View>
      </View>
      {day.goals.map((goal) => (
        <View key={goal.key} style={styles.historyGoal}>
          <Text style={styles.historyGoalLabel}>{goal.label}</Text>
          <Text style={styles.historyGoalCount}>{goal.completed} / {goal.target}</Text>
        </View>
      ))}
    </Card>
  );
}

function ProgressBar({ percentage, label }) {
  const safePercentage = Math.max(0, Math.min(100, Number(percentage) || 0));
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: safePercentage }} style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${safePercentage}%` }]} />
    </View>
  );
}

function iconFor(key) {
  return key === 'readingLessons' ? 'book-outline' : key === 'assessments' ? 'checkmark-done-outline' : 'create-outline';
}

const styles = StyleSheet.create({
  summaryCard: { gap: 14, backgroundColor: colors.greenLight, borderColor: '#D8E8DC' },
  dateLabel: { color: colors.greenDark, fontSize: 12, lineHeight: 18, fontWeight: '800' },
  summaryNumbers: { flexDirection: 'row', gap: 8 },
  summaryNumber: { flex: 1, minWidth: 0 },
  summaryValue: { color: colors.ink, fontSize: 17, lineHeight: 23, fontWeight: '800' },
  summaryLabel: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 2 },
  timeZoneNote: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  sectionHeading: { gap: 3 },
  sectionTitle: { color: colors.ink, fontSize: 17, lineHeight: 23, fontWeight: '800' },
  sectionHint: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  goalCard: { gap: 11 },
  goalHeading: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  goalIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.greenLight },
  goalIconComplete: { backgroundColor: '#D5E8D9' },
  goalCopy: { flex: 1, minWidth: 0 },
  goalTitle: { color: colors.ink, fontSize: 14, lineHeight: 19, fontWeight: '800' },
  goalCount: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  remainingText: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  targetEditor: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 9, borderTopWidth: 1, borderTopColor: colors.border },
  targetLabel: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: colors.greenLight },
  stepButtonDisabled: { opacity: 0.45 },
  stepSymbol: { color: colors.greenDark, fontSize: 20, lineHeight: 23, fontWeight: '700' },
  targetValue: { color: colors.ink, minWidth: 18, textAlign: 'center', fontSize: 16, fontWeight: '800' },
  saveButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.green, borderRadius: 13, paddingHorizontal: 16 },
  saveButtonDisabled: { backgroundColor: colors.muted, opacity: 0.5 },
  saveButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  successMessage: { color: colors.greenDark, textAlign: 'center', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  historyCard: { gap: 10 },
  historyHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  historyIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.greenLight },
  historyCopy: { flex: 1, minWidth: 0 },
  historyDate: { color: colors.ink, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  historySummary: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  historyGoal: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  historyGoalLabel: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  historyGoalCount: { color: colors.ink, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  progressTrack: { height: 8, overflow: 'hidden', borderRadius: 5, backgroundColor: '#E8ECE8' },
  progressFill: { height: '100%', borderRadius: 5, backgroundColor: colors.green },
  pressed: { opacity: 0.78 },
});
