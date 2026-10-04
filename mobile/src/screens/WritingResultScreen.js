import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AssessmentButton } from '../components/AssessmentComponents';
import { Card, Screen } from '../components/Screen';
import { ReadingHeader } from '../components/ReadingComponents';
import { api } from '../services/api';
import { colors } from '../theme';

const criteria = [
  ['grammar', 'Grammar'],
  ['vocabulary', 'Vocabulary'],
  ['organization', 'Organization'],
  ['coherence', 'Coherence'],
  ['developmentOfIdeas', 'Development of Ideas'],
];

export function WritingResultScreen({ navigation, route }) {
  const { lessonId, lessonTitle = 'Lesson', result } = route.params;
  const [aiFeedback, setAiFeedback] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  async function loadAIFeedback() {
    if (!result.submissionId || aiLoading) return;
    setAiLoading(true);
    setAiError('');
    try {
      const data = await api.getAIWritingFeedback(lessonId, result.submissionId);
      setAiFeedback(data.feedback);
    } catch (error) {
      setAiError(error.message || 'AI-assisted feedback is currently unavailable. Your rubric assessment is still available.');
    } finally {
      setAiLoading(false);
    }
  }

  function backToLesson() {
    const tabs = navigation.getParent();
    if (tabs) {
      tabs.navigate('Reading', { screen: 'Lesson', params: { lessonId } });
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }

  return (
    <Screen>
      <ReadingHeader title="Writing Assessment Complete" subtitle={lessonTitle} eyebrow="YOUR WRITING RESULT" />
      <Card style={styles.scoreCard}>
        <Text style={styles.scoreLabel}>TOTAL SCORE</Text>
        <Text style={styles.score}>{result.totalScore} / {result.maxScore}</Text>
        <Text style={styles.percentage}>{result.percentage}%</Text>
        <Text style={styles.wordCount}>{result.wordCount} words submitted</Text>
      </Card>
      <Card style={styles.rubricCard}>
        <Text style={styles.heading}>Rubric results</Text>
        {criteria.map(([key, label]) => (
          <View key={key} style={styles.criterion}>
            <View style={styles.criterionTop}>
              <Text style={styles.criterionLabel}>{label}</Text>
              <Text style={styles.criterionScore}>{result.rubricScores[key]} / 5</Text>
            </View>
            <Text style={styles.criterionFeedback}>{result.criterionFeedback[key]}</Text>
          </View>
        ))}
      </Card>
      <Card style={styles.feedbackCard}>
        <Text style={styles.heading}>Overall feedback</Text>
        <Text style={styles.feedback}>{result.feedback}</Text>
      </Card>
      {result.submissionId ? (
        <>
          <AssessmentButton
            title={aiLoading ? 'Getting AI-Assisted Feedback…' : (aiFeedback ? 'Refresh AI-Assisted Feedback' : 'Get AI-Assisted Feedback')}
            disabled={aiLoading}
            variant="secondary"
            onPress={loadAIFeedback}
          />
          {aiLoading ? (
            <Card style={styles.aiCard}>
              <ActivityIndicator color={colors.green} />
              <Text style={styles.aiInfo}>Preparing supplementary feedback about your writing…</Text>
            </Card>
          ) : null}
          {aiError ? (
            <Card style={styles.aiCard}>
              <Text style={styles.heading}>AI-Assisted Writing Feedback</Text>
              <Text accessibilityRole="alert" style={styles.aiInfo}>{aiError}</Text>
            </Card>
          ) : null}
          {aiFeedback ? (
            <Card style={styles.aiCard}>
              <Text style={styles.heading}>AI-Assisted Writing Feedback</Text>
              {[
                ['Strengths', aiFeedback.strengths],
                ['Areas for Improvement', aiFeedback.areasForImprovement],
                ['Suggestions', aiFeedback.suggestions],
              ].map(([title, items]) => (
                <View key={title} style={styles.aiSection}>
                  <Text style={styles.aiSectionTitle}>{title}</Text>
                  {items.map((item, index) => <Text key={`${index}-${item}`} style={styles.aiInfo}>• {item}</Text>)}
                </View>
              ))}
              <View style={styles.aiSection}>
                <Text style={styles.aiSectionTitle}>Encouragement</Text>
                <Text style={styles.aiInfo}>{aiFeedback.encouragement}</Text>
              </View>
              <Text style={styles.aiDisclaimer}>This feedback is supplementary guidance. Your official score and rubric feedback are shown above and are not determined by AI.</Text>
            </Card>
          ) : null}
        </>
      ) : null}
      <AssessmentButton title="Back to Lesson" onPress={backToLesson} />
      <AssessmentButton
        title="Try Again"
        variant="secondary"
        onPress={() => navigation.replace('WritingActivity', { lessonId, lessonTitle })}
      />
      <Text style={styles.note}>This rule-based score reflects visible writing features. It is a learning aid, not a complete grammar check or a judgment of the ideas’ factual accuracy.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scoreCard: { alignItems: 'center', gap: 6, paddingVertical: 23 },
  scoreLabel: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  score: { color: colors.greenDark, fontSize: 34, lineHeight: 42, fontWeight: '800' },
  percentage: { color: colors.ink, fontSize: 19, fontWeight: '700' },
  wordCount: { color: colors.muted, fontSize: 12 },
  rubricCard: { gap: 11 },
  heading: { color: colors.greenDark, fontSize: 16, fontWeight: '800' },
  criterion: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 9, gap: 4 },
  criterionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  criterionLabel: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  criterionScore: { color: colors.greenDark, fontSize: 13, fontWeight: '800' },
  criterionFeedback: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  feedbackCard: { gap: 8, backgroundColor: colors.greenLight, borderColor: '#D8E8DC' },
  feedback: { color: colors.ink, fontSize: 14, lineHeight: 22 },
  aiCard: { gap: 12, backgroundColor: colors.surface, borderColor: colors.border },
  aiSection: { gap: 5, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  aiSectionTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  aiInfo: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  aiDisclaimer: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  note: { color: colors.muted, textAlign: 'center', fontSize: 11, lineHeight: 17, paddingHorizontal: 10 },
});
