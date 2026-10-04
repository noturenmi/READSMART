import React, { useEffect, useState } from 'react';
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
        subtitle={learningFlow.lessonsSubtitle(subject)}
        eyebrow={learningFlow.lessonsEyebrow(subject, subjectCode)}
        onBack={() => navigation.goBack()}
      />
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
        />
      )) : null}
    </Screen>
  );
}
