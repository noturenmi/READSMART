import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../components/Screen';
import { LessonCard, ReadingHeader, ReadingState } from '../components/ReadingComponents';
import { api } from '../services/api';
import { getLearningFlow } from '../utils/learningFlow';

export function ReadingLessonsScreen({ navigation, route }) {
  const { subjectId, subjectName, subjectCode, flow } = route.params;
  const learningFlow = getLearningFlow(flow);
  const [subject, setSubject] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [bookmarkAttempt, setBookmarkAttempt] = useState(0);
  const [bookmarkedLessonIds, setBookmarkedLessonIds] = useState(() => new Set());
  const [bookmarkStatusLoading, setBookmarkStatusLoading] = useState(true);
  const [bookmarkStatusError, setBookmarkStatusError] = useState(false);
  const [bookmarkActionError, setBookmarkActionError] = useState(false);
  const [savingLessonIds, setSavingLessonIds] = useState(() => new Set());

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    api.getLessons(subjectId)
      .then((data) => {
        if (!active) return;
        setSubject(data.subject);
        setLessons(data.lessons || []);
      })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt, subjectId]);

  useFocusEffect(useCallback(() => {
    let active = true;
    setBookmarkStatusLoading(true);
    setBookmarkStatusError(false);
    api.getSavedLessons()
      .then((data) => {
        if (!active) return;
        setBookmarkedLessonIds(new Set((data.bookmarks || []).map(({ lesson }) => lesson.id)));
      })
      .catch(() => { if (active) setBookmarkStatusError(true); })
      .finally(() => { if (active) setBookmarkStatusLoading(false); });
    return () => { active = false; };
  }, [bookmarkAttempt, subjectId]));

  async function toggleBookmark(lessonId) {
    if (savingLessonIds.has(lessonId)) return;
    const wasBookmarked = bookmarkedLessonIds.has(lessonId);
    setBookmarkActionError(false);
    setBookmarkedLessonIds((current) => {
      const next = new Set(current);
      if (wasBookmarked) next.delete(lessonId);
      else next.add(lessonId);
      return next;
    });
    setSavingLessonIds((current) => new Set(current).add(lessonId));
    try {
      if (wasBookmarked) await api.removeLessonBookmark(lessonId);
      else await api.bookmarkLesson(lessonId);
    } catch {
      setBookmarkedLessonIds((current) => {
        const next = new Set(current);
        if (wasBookmarked) next.add(lessonId);
        else next.delete(lessonId);
        return next;
      });
      setBookmarkActionError(true);
    } finally {
      setSavingLessonIds((current) => {
        const next = new Set(current);
        next.delete(lessonId);
        return next;
      });
    }
  }

  return (
    <Screen>
      <ReadingHeader
        title={subject?.name || subjectName}
        subtitle={learningFlow.lessonsSubtitle(subject)}
        eyebrow={learningFlow.lessonsEyebrow(subject, subjectCode)}
        onBack={() => navigation.goBack()}
      />
      {bookmarkStatusLoading ? <ReadingState kind="loading" title="Checking saved lessons..." /> : null}
      {!bookmarkStatusLoading && bookmarkStatusError ? (
        <ReadingState kind="error" title="Unable to load bookmark status." message="Lessons are still available. Try loading saved lessons again." onRetry={() => setBookmarkAttempt((value) => value + 1)} />
      ) : null}
      {bookmarkActionError ? (
        <ReadingState kind="error" title="Could not update that bookmark." message="Your saved state was restored. Tap the bookmark again to retry." onRetry={() => setBookmarkAttempt((value) => value + 1)} />
      ) : null}
      {loading ? <ReadingState kind="loading" title="Loading lessons..." /> : null}
      {!loading && failed ? (
        <ReadingState kind="error" title="Unable to load lessons." message="Please check your connection and try again." onRetry={() => setAttempt((value) => value + 1)} />
      ) : null}
      {!loading && !failed && lessons.length === 0 ? (
        <ReadingState
          kind="empty"
          title={learningFlow.noLessonsTitle}
          message={learningFlow.noLessonsMessage}
        />
      ) : null}
      {!loading && !failed ? lessons.map((lesson) => (
        <LessonCard
          key={lesson.id}
          lesson={lesson}
          onPress={() => navigation.navigate(learningFlow.destination, learningFlow.lessonParams(lesson))}
          isBookmarked={bookmarkedLessonIds.has(lesson.id)}
          bookmarkLoading={bookmarkStatusLoading || savingLessonIds.has(lesson.id)}
          onToggleBookmark={bookmarkStatusError ? undefined : () => toggleBookmark(lesson.id)}
        />
      )) : null}
    </Screen>
  );
}
