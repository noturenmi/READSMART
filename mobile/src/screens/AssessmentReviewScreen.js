import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AssessmentButton } from '../components/AssessmentComponents';
import { Card, Screen } from '../components/Screen';
import { ReadingHeader, ReadingState } from '../components/ReadingComponents';
import { api } from '../services/api';
import { colors } from '../theme';

export function AssessmentReviewScreen({ navigation, route }) {
  const { lessonId, attemptId, lessonTitle = 'Lesson' } = route.params || {};
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    if (!lessonId || !attemptId) {
      setError('This assessment review is unavailable. Return to the result screen and try again.');
      setLoading(false);
      return () => { active = false; };
    }

    api.getAssessmentReview(lessonId, attemptId)
      .then((data) => { if (active) setReview(data); })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Unable to load this assessment review.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attemptId, lessonId, reload]);

  const subjectName = review?.lesson?.subject?.name;
  const displayedLessonTitle = review?.lesson?.title || lessonTitle;

  return (
    <Screen>
      <ReadingHeader
        title="Review Incorrect Answers"
        subtitle={displayedLessonTitle}
        eyebrow={subjectName || 'ASSESSMENT REVIEW'}
        onBack={() => navigation.goBack()}
      />
      {loading ? <ReadingState kind="loading" title="Loading your answer review..." /> : null}
      {!loading && error ? (
        <ReadingState
          kind="error"
          title="Unable to load your review."
          message={error}
          onRetry={() => setReload((value) => value + 1)}
        />
      ) : null}
      {!loading && !error && review?.allCorrect ? (
        <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 25, backgroundColor: colors.greenLight, borderColor: '#D8E8DC' }}>
          <Ionicons name="checkmark-circle" size={38} color={colors.greenDark} />
          <Text style={{ color: colors.greenDark, textAlign: 'center', fontSize: 17, lineHeight: 24, fontWeight: '800' }}>
            Excellent! You answered all questions correctly. Keep up the good work!
          </Text>
        </Card>
      ) : null}
      {!loading && !error && review && !review.allCorrect && review.incorrectAnswers?.length === 0 ? (
        <ReadingState kind="empty" title="There are no incorrect answers to review for this attempt." />
      ) : null}
      {!loading && !error && review?.incorrectAnswers?.map((item) => (
        <Card key={item.questionId} style={{ gap: 12 }}>
          <Text style={{ color: colors.green, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 }}>
            QUESTION {item.order}
          </Text>
          <Text style={{ color: colors.ink, fontSize: 16, lineHeight: 24, fontWeight: '700' }}>
            {item.question}
          </Text>
          {item.questionAvailable ? (
            <>
              <View style={{ gap: 5, padding: 12, borderRadius: 12, backgroundColor: '#FCECEA', borderWidth: 1, borderColor: '#F1D2CE' }}>
                <Text style={{ color: '#9E3C36', fontSize: 11, fontWeight: '800' }}>YOUR ANSWER</Text>
                <Text style={{ color: colors.ink, fontSize: 14, lineHeight: 21 }}>
                  {item.yourAnswer || 'Your selected answer is unavailable.'}
                </Text>
              </View>
              <View style={{ gap: 5, padding: 12, borderRadius: 12, backgroundColor: colors.greenLight, borderWidth: 1, borderColor: '#D8E8DC' }}>
                <Text style={{ color: colors.greenDark, fontSize: 11, fontWeight: '800' }}>CORRECT ANSWER</Text>
                <Text style={{ color: colors.ink, fontSize: 14, lineHeight: 21 }}>
                  {item.correctAnswer || 'The correct answer is unavailable.'}
                </Text>
              </View>
              <View style={{ gap: 5 }}>
                <Text style={{ color: colors.greenDark, fontSize: 13, fontWeight: '800' }}>Explanation</Text>
                <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 20 }}>
                  {item.explanation || 'The explanation for this question is no longer available.'}
                </Text>
              </View>
            </>
          ) : (
            <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 20 }}>
              The original question details are no longer available, so its answers and explanation cannot be shown.
            </Text>
          )}
        </Card>
      ))}
      <AssessmentButton title="Back to Results" variant="secondary" onPress={() => navigation.goBack()} />
    </Screen>
  );
}
