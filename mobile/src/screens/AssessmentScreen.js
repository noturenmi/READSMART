import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { AssessmentButton, AssessmentChoice } from '../components/AssessmentComponents';
import { Card, Screen } from '../components/Screen';
import { ReadingHeader, ReadingState } from '../components/ReadingComponents';
import { api } from '../services/api';
import { colors } from '../theme';

export function AssessmentScreen({ navigation, route }) {
  const { lessonId, lessonTitle = 'Lesson' } = route.params;
  const [questions, setQuestions] = useState([]);
  const [selections, setSelections] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    api.getLessonQuestions(lessonId)
      .then((data) => {
        if (!active) return;
        setQuestions(data.questions || []);
        setSelections({});
        setCurrentIndex(0);
      })
      .catch((error) => { if (active) setLoadError(error.message || 'Unable to load the assessment.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [lessonId, loadAttempt]);

  const currentQuestion = questions[currentIndex];
  const answeredCount = useMemo(() => questions.filter(({ id }) => Number.isInteger(selections[id])).length, [questions, selections]);
  const allAnswered = questions.length > 0 && answeredCount === questions.length;

  async function submitAssessment() {
    if (!allAnswered || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const answers = questions.map(({ id }) => ({ questionId: id, selectedAnswer: selections[id] }));
      const result = await api.submitLessonAssessment(lessonId, answers);
      navigation.replace('AssessmentResult', { lessonId, lessonTitle, result });
    } catch (error) {
      setSubmitError(error.message || 'Unable to submit your assessment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <ReadingHeader
        title="Reading assessment"
        subtitle={lessonTitle}
        eyebrow="CHECK YOUR UNDERSTANDING"
        onBack={() => navigation.goBack()}
      />
      {loading ? <ReadingState kind="loading" title="Loading questions..." /> : null}
      {!loading && loadError ? (
        <ReadingState kind="error" title="Unable to load the assessment." message={loadError} onRetry={() => setLoadAttempt((value) => value + 1)} />
      ) : null}
      {!loading && !loadError && questions.length === 0 ? (
        <ReadingState kind="empty" title="Assessment questions are not available yet." message="Please check back later." />
      ) : null}
      {!loading && !loadError && currentQuestion ? (
        <>
          <Card style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: colors.green, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 }}>
                QUESTION {currentIndex + 1} OF {questions.length}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{answeredCount} answered</Text>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.greenLight, overflow: 'hidden' }}>
              <View style={{ width: `${((currentIndex + 1) / questions.length) * 100}%`, height: 6, backgroundColor: colors.green }} />
            </View>
            <Text style={{ color: colors.ink, fontSize: 18, lineHeight: 27, fontWeight: '700', marginTop: 4 }}>
              {currentQuestion.question}
            </Text>
          </Card>
          <View style={{ gap: 10 }}>
            {currentQuestion.choices.map((choice, index) => (
              <AssessmentChoice
                key={`${currentQuestion.id}-${index}`}
                index={index}
                label={choice}
                selected={selections[currentQuestion.id] === index}
                onPress={() => setSelections((current) => ({ ...current, [currentQuestion.id]: index }))}
              />
            ))}
          </View>
          {submitError ? <Text accessibilityRole="alert" style={{ color: '#A2392D', fontSize: 13, lineHeight: 19 }}>{submitError}</Text> : null}
          {currentIndex === questions.length - 1 && !allAnswered ? (
            <Text style={{ color: colors.muted, textAlign: 'center', fontSize: 13, lineHeight: 19 }}>
              Answer all {questions.length} questions before submitting.
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <AssessmentButton
                title="Previous"
                variant="secondary"
                disabled={currentIndex === 0 || submitting}
                onPress={() => setCurrentIndex((index) => Math.max(0, index - 1))}
              />
            </View>
            <View style={{ flex: 1 }}>
              {currentIndex < questions.length - 1 ? (
                <AssessmentButton title="Next" disabled={submitting} onPress={() => setCurrentIndex((index) => Math.min(questions.length - 1, index + 1))} />
              ) : (
                <AssessmentButton title={submitting ? 'Submitting...' : 'Submit Assessment'} disabled={!allAnswered || submitting} onPress={submitAssessment} />
              )}
            </View>
          </View>
          {submitting ? <ActivityIndicator color={colors.green} /> : null}
        </>
      ) : null}
    </Screen>
  );
}
