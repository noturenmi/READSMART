import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { AssessmentButton } from '../components/AssessmentComponents';
import { Card, Screen } from '../components/Screen';
import { ContentSection, ReadingHeader, ReadingParagraph, ReadingState } from '../components/ReadingComponents';
import { api } from '../services/api';
import { colors } from '../theme';

export function LessonDetailScreen({ navigation, route }) {
  const { lessonId } = route.params;
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    api.getLesson(lessonId)
      .then((data) => { if (active) setLesson(data.lesson); })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt, lessonId]);

  async function generateSummary() {
    setSummaryLoading(true);
    setSummaryError('');
    try {
      const result = await api.getLessonSummary(lessonId);
      setSummary(result.summary);
    } catch (error) {
      setSummaryError(error.message || 'The AI summary is currently unavailable. You can continue reading the original lesson.');
    } finally {
      setSummaryLoading(false);
    }
  }

  return (
    <Screen>
      <ReadingHeader
        title={lesson?.title || 'Lesson'}
        subtitle={lesson?.subject?.name || ''}
        eyebrow={lesson ? `LESSON ${lesson.lessonNumber}` : 'READING'}
        onBack={() => navigation.goBack()}
      />
      {loading ? <ReadingState kind="loading" title="Loading lesson..." /> : null}
      {!loading && failed ? (
        <ReadingState kind="error" title="Unable to load this lesson." message="Please check your connection and try again." onRetry={() => setAttempt((value) => value + 1)} />
      ) : null}
      {!loading && !failed && lesson ? (
        <>
          <View style={{ gap: 14 }}>
            <ContentSection title="Lesson" hasContent={Boolean(lesson.overview || lesson.lesson)}>
              {lesson.overview ? <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 21 }}>{lesson.overview}</Text> : null}
              <ReadingParagraph>{lesson.lesson}</ReadingParagraph>
            </ContentSection>
            <ContentSection title="Discussion" hasContent={Boolean(lesson.discussion)}><ReadingParagraph>{lesson.discussion}</ReadingParagraph></ContentSection>
            <ContentSection title="Example" hasContent={Boolean(lesson.example)}><ReadingParagraph>{lesson.example}</ReadingParagraph></ContentSection>
            <ContentSection title="Key Concepts" hasContent={Boolean(lesson.keyConcepts?.length)}>
              {Array.isArray(lesson.keyConcepts) ? lesson.keyConcepts.map((concept, index) => (
                <View key={`${index}-${concept}`} style={{ flexDirection: 'row', gap: 9, alignItems: 'flex-start' }}>
                  <Text style={{ color: colors.green, fontSize: 17, lineHeight: 24 }}>•</Text>
                  <Text style={{ color: colors.ink, flex: 1, fontSize: 15, lineHeight: 24 }}>{concept}</Text>
                </View>
              )) : null}
            </ContentSection>
            <ContentSection title="Key Takeaway" takeaway hasContent={Boolean(lesson.keyTakeaway)}><ReadingParagraph>{lesson.keyTakeaway}</ReadingParagraph></ContentSection>
            {!lesson.lesson && !lesson.discussion && !lesson.example && !lesson.keyConcepts?.length && !lesson.keyTakeaway ? (
              <ReadingState kind="empty" title="Lesson content is being prepared." message="Please check back later." />
            ) : null}
          </View>
          <AssessmentButton
            title={summaryLoading ? 'Generating Summary…' : (summary ? 'Refresh AI-Assisted Summary' : 'Generate Summary')}
            disabled={summaryLoading}
            onPress={generateSummary}
          />
          {summaryLoading ? (
            <Card style={{ alignItems: 'center', gap: 10 }}>
              <ActivityIndicator color={colors.green} />
              <Text style={{ color: colors.muted, fontSize: 13 }}>Preparing a supplementary lesson summary…</Text>
            </Card>
          ) : null}
          {summaryError ? (
            <Card style={{ gap: 8 }}>
              <Text style={{ color: colors.greenDark, fontSize: 15, fontWeight: '800' }}>AI-Assisted Summary</Text>
              <Text accessibilityRole="alert" style={{ color: colors.muted, fontSize: 13, lineHeight: 20 }}>{summaryError}</Text>
            </Card>
          ) : null}
          {summary ? (
            <Card style={{ gap: 12, backgroundColor: colors.greenLight, borderColor: '#D8E8DC' }}>
              <Text style={{ color: colors.greenDark, fontSize: 16, fontWeight: '800' }}>AI-Assisted Summary</Text>
              <View style={{ gap: 5 }}>
                <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '800' }}>Main Idea</Text>
                <Text style={{ color: colors.ink, fontSize: 14, lineHeight: 21 }}>{summary.mainIdea}</Text>
              </View>
              {summary.importantIdeas?.length ? (
                <View style={{ gap: 6 }}>
                  <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '800' }}>Important Ideas</Text>
                  {summary.importantIdeas.map((idea, index) => (
                    <Text key={`${index}-${idea}`} style={{ color: colors.ink, fontSize: 13, lineHeight: 20 }}>• {idea}</Text>
                  ))}
                </View>
              ) : null}
              {summary.importantConcepts?.length ? (
                <View style={{ gap: 6 }}>
                  <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '800' }}>Important Concepts</Text>
                  {summary.importantConcepts.map(({ term, explanation }) => (
                    <Text key={term} style={{ color: colors.ink, fontSize: 13, lineHeight: 20 }}><Text style={{ fontWeight: '800' }}>{term}: </Text>{explanation}</Text>
                  ))}
                </View>
              ) : null}
              <View style={{ gap: 5 }}>
                <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '800' }}>Takeaway</Text>
                <Text style={{ color: colors.ink, fontSize: 14, lineHeight: 21 }}>{summary.takeaway}</Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 16 }}>Supplementary AI guidance. The original lesson remains the primary reading material.</Text>
            </Card>
          ) : null}
          <AssessmentButton
            title="Start Assessment"
            onPress={() => navigation.navigate('Assessment', { lessonId, lessonTitle: lesson.title })}
          />
          <AssessmentButton
            title="Start Writing Activity"
            variant="secondary"
            onPress={() => navigation.navigate('WritingActivity', { lessonId, lessonTitle: lesson.title })}
          />
        </>
      ) : null}
    </Screen>
  );
}
