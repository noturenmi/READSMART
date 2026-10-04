import React, { useEffect, useState } from 'react';
import { Screen } from '../components/Screen';
import { LessonCard, ReadingHeader, ReadingState } from '../components/ReadingComponents';
import { api } from '../services/api';

export function ReadingLessonsScreen({ navigation, route }) {
  const { subjectId, subjectName, subjectCode } = route.params;
  const [subject, setSubject] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

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

  return (
    <Screen>
      <ReadingHeader
        title={subject?.name || subjectName}
        subtitle={subject?.availableLessonCount > 0 ? `${subject.availableLessonCount} published lessons` : 'Lessons for this subject'}
        eyebrow={subject?.code || subjectCode || 'SUBJECT'}
        onBack={() => navigation.goBack()}
      />
      {loading ? <ReadingState kind="loading" title="Loading lessons..." /> : null}
      {!loading && failed ? (
        <ReadingState kind="error" title="Unable to load lessons." message="Please check your connection and try again." onRetry={() => setAttempt((value) => value + 1)} />
      ) : null}
      {!loading && !failed && lessons.length === 0 ? (
        <ReadingState kind="empty" title="No published lessons yet." message="Lesson content is being prepared for this subject." />
      ) : null}
      {!loading && !failed ? lessons.map((lesson) => (
        <LessonCard key={lesson.id} lesson={lesson} onPress={() => navigation.navigate('Lesson', { lessonId: lesson.id })} />
      )) : null}
    </Screen>
  );
}
