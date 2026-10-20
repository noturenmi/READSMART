import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { AssessmentButton } from '../components/AssessmentComponents';
import { Card, Screen } from '../components/Screen';
import { ReadingHeader, ReadingState } from '../components/ReadingComponents';
import { api } from '../services/api';
import { colors } from '../theme';

const wordPattern = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu;

function createRequestKey() {
  return `writing-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function countWords(text) {
  return (text.match(wordPattern) || []).length;
}

export function WritingActivityScreen({ navigation, route }) {
  const { lessonId, lessonTitle = 'Lesson' } = route.params;
  const [activity, setActivity] = useState(null);
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const requestKey = useRef(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    api.getLessonWritingActivity(lessonId)
      .then((data) => { if (active) setActivity(data.activity); })
      .catch((error) => { if (active) setLoadError(error.message || 'Unable to load this writing activity.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [lessonId, loadAttempt]);

  const wordCount = useMemo(() => countWords(response), [response]);
  const belowMinimum = activity && wordCount < activity.minimumWords;
  const aboveMaximum = activity && wordCount > activity.maximumWords;
  const canSubmit = Boolean(activity && response.trim() && !belowMinimum && !aboveMaximum && !submitting);

  async function submitResponse() {
    if (!canSubmit || submittingRef.current) return;
    submittingRef.current = true;
    requestKey.current ||= createRequestKey();
    setSubmitting(true);
    setSubmitError('');
    try {
      const result = await api.submitLessonWriting(lessonId, activity.id, response, requestKey.current);
      navigation.replace('WritingResult', {
        lessonId,
        lessonTitle: activity.lessonTitle || lessonTitle,
        result,
      });
    } catch (error) {
      setSubmitError(error.message || 'Unable to submit your response. Please try again.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <ReadingHeader
        title={activity?.title || 'Writing activity'}
        subtitle={activity?.lessonTitle || lessonTitle}
        eyebrow="WRITE & REFLECT"
        onBack={() => navigation.goBack()}
      />
      {loading ? <ReadingState kind="loading" title="Loading writing activity..." /> : null}
      {!loading && loadError ? (
        <ReadingState kind="error" title="Unable to load this activity." message={loadError} onRetry={() => setLoadAttempt((value) => value + 1)} />
      ) : null}
      {!loading && !loadError && activity ? (
        <>
          <Card style={styles.promptCard}>
            <Text style={styles.label}>WRITING PROMPT</Text>
            <Text style={styles.prompt}>{activity.prompt}</Text>
          </Card>
          <Card style={styles.instructionsCard}>
            <Text style={styles.sectionTitle}>Instructions</Text>
            <Text style={styles.body}>{activity.instructions}</Text>
            <Text style={styles.wordRule}>Required length: {activity.minimumWords}–{activity.maximumWords} words</Text>
          </Card>
          <Card style={styles.rubricCard}>
            <Text style={styles.sectionTitle}>Assessment rubric</Text>
            <Text style={styles.scale}>Ratings: 5 Excellent · 4 Good · 3 Satisfactory · 2 Needs Improvement · 1 Poor</Text>
            {activity.criteria.map((criterion) => (
              <View key={criterion.key} style={styles.criterion}>
                <Text style={styles.criterionTitle}>{criterion.label}</Text>
                <Text style={styles.body}>{criterion.description}</Text>
              </View>
            ))}
          </Card>
          <Card style={styles.editorCard}>
            <View style={styles.editorHeading}>
              <Text style={styles.sectionTitle}>Your response</Text>
              <Text style={[styles.wordCount, belowMinimum && styles.countWarning, aboveMaximum && styles.countWarning]}>
                {wordCount} words
              </Text>
            </View>
            <TextInput
              accessibilityLabel="Your writing response"
              accessibilityHint="Write a response that meets the displayed word-count requirement."
              value={response}
              onChangeText={(text) => {
                if (text !== response) requestKey.current = null;
                setResponse(text);
                setSubmitError('');
              }}
              editable={!submitting}
              multiline
              maxLength={15000}
              placeholder="Write your response here..."
              placeholderTextColor={colors.muted}
              textAlignVertical="top"
              style={styles.input}
            />
            {belowMinimum ? (
              <Text style={styles.wordMessage}>Add at least {activity.minimumWords - wordCount} more words to submit.</Text>
            ) : null}
            {aboveMaximum ? (
              <Text style={styles.wordMessage}>Remove {wordCount - activity.maximumWords} words to meet the maximum.</Text>
            ) : null}
          </Card>
          {submitError ? <Text accessibilityRole="alert" style={styles.error}>{submitError}</Text> : null}
          <AssessmentButton
            title={submitting ? 'Assessing response...' : 'Submit for Assessment'}
            disabled={!canSubmit}
            onPress={submitResponse}
          />
          {submitting ? <ActivityIndicator color={colors.green} /> : null}
          <Text style={styles.note}>Scores use visible writing features such as structure, transitions, and punctuation. They do not detect every grammar error or judge factual accuracy.</Text>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  promptCard: { gap: 9, backgroundColor: colors.greenLight, borderColor: '#D8E8DC' },
  label: { color: colors.green, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  prompt: { color: colors.ink, fontSize: 15, lineHeight: 24 },
  instructionsCard: { gap: 8 },
  sectionTitle: { color: colors.greenDark, fontSize: 16, fontWeight: '800' },
  body: { color: colors.ink, fontSize: 13, lineHeight: 20 },
  wordRule: { color: colors.greenDark, fontSize: 12, fontWeight: '700', marginTop: 2 },
  rubricCard: { gap: 10 },
  scale: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  criterion: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, gap: 3 },
  criterionTitle: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  editorCard: { gap: 10 },
  editorHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  wordCount: { color: colors.green, fontSize: 12, fontWeight: '700' },
  countWarning: { color: '#A2392D' },
  input: { minHeight: 220, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: '#FCFDFC', paddingHorizontal: 13, paddingVertical: 12, color: colors.ink, fontSize: 15, lineHeight: 23 },
  wordMessage: { color: '#A2392D', fontSize: 12, lineHeight: 18 },
  error: { color: '#9E3C36', backgroundColor: '#FCECEA', borderRadius: 12, padding: 12, fontSize: 13, lineHeight: 19 },
  note: { color: colors.muted, textAlign: 'center', fontSize: 11, lineHeight: 17, paddingHorizontal: 10 },
});
