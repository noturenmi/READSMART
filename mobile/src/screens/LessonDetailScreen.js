import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AssessmentButton } from '../components/AssessmentComponents';
import { Card, Screen } from '../components/Screen';
import { BookmarkButton, ContentSection, ReadingHeader, ReadingParagraph, ReadingState } from '../components/ReadingComponents';
import { api } from '../services/api';
import { colors } from '../theme';

export function LessonDetailScreen({ navigation, route }) {
  const { lessonId } = route.params;
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [summary, setSummary] = useState(null);
  const [summaryCacheLoading, setSummaryCacheLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  const summaryRequestInFlight = useRef(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkStatusLoading, setBookmarkStatusLoading] = useState(true);
  const [bookmarkStatusError, setBookmarkStatusError] = useState(false);
  const [bookmarkActionError, setBookmarkActionError] = useState(false);
  const [bookmarkSaving, setBookmarkSaving] = useState(false);
  const [bookmarkAttempt, setBookmarkAttempt] = useState(0);

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

  useEffect(() => {
    let active = true;
    setSummary(null);
    setSummaryError('');
    setSummaryCacheLoading(true);
    api.getCachedLessonSummary(lessonId)
      .then((result) => { if (active) setSummary(result.summary); })
      .catch((error) => {
        if (active) setSummaryError(error.message || 'Unable to check for a saved summary. You can still try generating one.');
      })
      .finally(() => { if (active) setSummaryCacheLoading(false); });
    return () => { active = false; };
  }, [lessonId]);

  useEffect(() => {
    let active = true;
    setBookmarkStatusLoading(true);
    setBookmarkStatusError(false);
    api.getLessonBookmark(lessonId)
      .then((result) => { if (active) setBookmarked(result.isBookmarked); })
      .catch(() => { if (active) setBookmarkStatusError(true); })
      .finally(() => { if (active) setBookmarkStatusLoading(false); });
    return () => { active = false; };
  }, [bookmarkAttempt, lessonId]);

  async function requestSummary(regenerate) {
    if (summaryRequestInFlight.current || summaryCacheLoading || (regenerate && !summary) || (!regenerate && summary)) return;
    summaryRequestInFlight.current = true;
    setSummaryLoading(true);
    setSummaryError('');
    try {
      const result = await api.getLessonSummary(lessonId, { regenerate });
      setSummary(result.summary);
    } catch (error) {
      setSummaryError(error.message || 'The AI summary is currently unavailable. You can continue reading the original lesson.');
    } finally {
      summaryRequestInFlight.current = false;
      setSummaryLoading(false);
    }
  }

  function generateSummary() {
    return requestSummary(false);
  }

  function regenerateSummary() {
    return requestSummary(true);
  }

  async function toggleBookmark() {
    if (bookmarkSaving || bookmarkStatusLoading || bookmarkStatusError) return;
    const wasBookmarked = bookmarked;
    setBookmarked(!wasBookmarked);
    setBookmarkActionError(false);
    setBookmarkSaving(true);
    try {
      if (wasBookmarked) await api.removeLessonBookmark(lessonId);
      else await api.bookmarkLesson(lessonId);
    } catch {
      setBookmarked(wasBookmarked);
      setBookmarkActionError(true);
    } finally {
      setBookmarkSaving(false);
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
      {!loading && !failed && lesson ? (
        <View style={styles.bookmarkArea}>
          <BookmarkButton
            isBookmarked={bookmarked}
            loading={bookmarkStatusLoading || bookmarkSaving}
            disabled={bookmarkStatusError}
            onPress={toggleBookmark}
            showLabel
          />
          {bookmarkStatusError ? (
            <ReadingState kind="error" title="Unable to check saved status." message="Retry to check whether this lesson is bookmarked." onRetry={() => setBookmarkAttempt((value) => value + 1)} />
          ) : null}
          {bookmarkActionError ? (
            <Text accessibilityRole="alert" style={styles.bookmarkError}>Could not update the bookmark. Your previous saved state was restored. Try again.</Text>
          ) : null}
        </View>
      ) : null}
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
          {summaryCacheLoading ? (
            <Card style={{ alignItems: 'center', gap: 10 }}>
              <ActivityIndicator color={colors.green} />
              <Text style={{ color: colors.muted, fontSize: 13 }}>Checking for a saved summary…</Text>
            </Card>
          ) : (
            <AssessmentButton
              title={summaryLoading ? 'Generating Summary…' : (summary ? 'Regenerate Summary' : 'Generate Summary')}
              disabled={summaryLoading}
              onPress={summary ? regenerateSummary : generateSummary}
            />
          )}
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

const styles = StyleSheet.create({
  bookmarkArea: { gap: 8, alignItems: 'flex-start' },
  bookmarkError: { color: '#9B4A3E', fontSize: 12, lineHeight: 18 },
});
