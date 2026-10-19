import React from 'react';
import { Text, View } from 'react-native';
import { AssessmentButton } from '../components/AssessmentComponents';
import { Card, Screen } from '../components/Screen';
import { ReadingHeader } from '../components/ReadingComponents';
import { colors } from '../theme';

export function AssessmentResultScreen({ navigation, route }) {
  const { lessonId, lessonTitle = 'Lesson', result } = route.params;
  return (
    <Screen>
      <ReadingHeader title="Assessment Complete!" subtitle={lessonTitle} eyebrow="YOUR RESULTS" />
      <Card style={{ alignItems: 'center', gap: 9, paddingVertical: 25 }}>
        <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '700' }}>SCORE</Text>
        <Text style={{ color: colors.greenDark, fontSize: 36, lineHeight: 44, fontWeight: '800' }}>
          {result.score} / {result.totalPoints}
        </Text>
        <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '700' }}>
          {result.percentage}%
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{result.totalItems} questions</Text>
      </Card>
      <Card style={{ gap: 9, backgroundColor: colors.greenLight, borderColor: '#D8E8DC' }}>
        <Text style={{ color: colors.greenDark, fontSize: 15, fontWeight: '800' }}>Feedback</Text>
        <Text style={{ color: colors.ink, fontSize: 14, lineHeight: 22 }}>{result.feedback}</Text>
      </Card>
      {Array.isArray(result.answers) && result.answers.length ? (
        <Card style={{ gap: 8 }}>
          <Text style={{ color: colors.greenDark, fontSize: 15, fontWeight: '800' }}>Answer review</Text>
          {result.answers.map((answer, index) => (
            <View key={answer.questionId} style={{ paddingVertical: 5, gap: 3 }}>
              <Text style={{ color: answer.isCorrect ? colors.greenDark : '#A2392D', fontSize: 13, fontWeight: '700' }}>
                Question {index + 1}: {answer.isCorrect ? 'Correct' : 'Review this answer'}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>{answer.explanation}</Text>
            </View>
          ))}
        </Card>
      ) : null}
      {result.attemptId ? (
        <AssessmentButton
          title="Review Incorrect Answers"
          variant="secondary"
          onPress={() => navigation.navigate('AssessmentReview', { lessonId, lessonTitle, attemptId: result.attemptId })}
        />
      ) : null}
      <AssessmentButton title="Back to Lesson" onPress={() => navigation.navigate('Lesson', { lessonId })} />
      <AssessmentButton title="Try Again" variant="secondary" onPress={() => navigation.replace('Assessment', { lessonId, lessonTitle })} />
    </Screen>
  );
}
