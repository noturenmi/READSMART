import React, { useEffect, useState } from 'react';
import { Screen } from '../components/Screen';
import { ReadingHeader, ReadingState, SubjectCard } from '../components/ReadingComponents';
import { api } from '../services/api';
import { getLearningFlow } from '../utils/learningFlow';

export function ReadingScreen({ navigation, route }) {
  const flow = getLearningFlow(route.params?.flow);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    api.getSubjects()
      .then((data) => { if (active) setSubjects(data.subjects || []); })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);

  return (
    <Screen>
      <ReadingHeader
        title={flow.libraryTitle}
        subtitle={flow.librarySubtitle}
        eyebrow={flow.libraryEyebrow}
      />
      {loading ? <ReadingState kind="loading" title="Loading subjects..." /> : null}
      {!loading && failed ? (
        <ReadingState kind="error" title="Unable to load subjects." message="Please check your connection and try again." onRetry={() => setAttempt((value) => value + 1)} />
      ) : null}
      {!loading && !failed && subjects.length === 0 ? (
        <ReadingState
          kind="empty"
          title="No subjects are available yet."
          message={flow.noSubjectsMessage}
        />
      ) : null}
      {!loading && !failed ? subjects.map((subject) => (
        <SubjectCard
          key={subject.id}
          subject={subject}
          onPress={() => navigation.navigate('Lessons', {
            subjectId: subject.id,
            subjectName: subject.name,
            subjectCode: subject.code,
            flow: flow.key,
          })}
        />
      )) : null}
    </Screen>
  );
}
