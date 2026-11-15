import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LessonCard, ReadingHeader, ReadingState } from '../components/ReadingComponents';
import { api } from '../services/api';
import { Screen } from '../components/Screen';
import { colors } from '../theme';

export function SavedLessonsScreen({ navigation }) {
  const [bookmarks, setBookmarks] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [savingLessonId, setSavingLessonId] = useState('');
  const [actionError, setActionError] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    setActionError(false);
    api.getSavedLessons()
      .then((result) => { if (active) setBookmarks(result.bookmarks || []); })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    api.getSubjects()
      .then((result) => { if (active) setSubjects(result.subjects || []); })
      .catch(() => { if (active) setSubjects([]); });
    return () => { active = false; };
  }, [reload]));

  const subjectOptions = useMemo(() => {
    if (subjects.length) return subjects;
    const found = new Map();
    bookmarks.forEach(({ lesson }) => {
      if (lesson?.subject?.id) found.set(lesson.subject.id, lesson.subject);
    });
    return [...found.values()];
  }, [subjects, bookmarks]);

  const visibleBookmarks = useMemo(() => selectedSubjectId === 'all'
    ? bookmarks
    : bookmarks.filter(({ lesson }) => lesson?.subject?.id === selectedSubjectId), [bookmarks, selectedSubjectId]);

  async function removeBookmark(lessonId) {
    if (savingLessonId) return;
    const previousEntry = bookmarks.find(({ lesson }) => lesson.id === lessonId);
    if (!previousEntry) return;
    setSavingLessonId(lessonId);
    setActionError(false);
    setBookmarks((current) => current.filter(({ lesson }) => lesson.id !== lessonId));
    try {
      await api.removeLessonBookmark(lessonId);
    } catch {
      setBookmarks((current) => current.some(({ lesson }) => lesson.id === lessonId)
        ? current
        : [...current, previousEntry].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      setActionError(true);
    } finally {
      setSavingLessonId('');
    }
  }

  return (
    <Screen>
      <ReadingHeader title="Saved Lessons" subtitle="Your bookmarked reading materials" onBack={() => navigation.goBack()} />
      {loading ? <ReadingState kind="loading" title="Loading saved lessons..." /> : null}
      {!loading && failed ? (
        <ReadingState kind="error" title="Unable to load saved lessons." message="Please check your connection and try again." onRetry={() => setReload((value) => value + 1)} />
      ) : null}
      {!loading && !failed && bookmarks.length > 0 ? (
        <View style={styles.filters}>
          <FilterChip title="All" selected={selectedSubjectId === 'all'} onPress={() => setSelectedSubjectId('all')} />
          {subjectOptions.map((subject) => (
            <FilterChip
              key={subject.id}
              title={subject.code}
              selected={selectedSubjectId === subject.id}
              onPress={() => setSelectedSubjectId(subject.id)}
            />
          ))}
        </View>
      ) : null}
      {actionError ? (
        <ReadingState kind="error" title="Could not remove that bookmark." message="The lesson is still saved. Tap its bookmark again to retry." onRetry={() => setReload((value) => value + 1)} />
      ) : null}
      {!loading && !failed && bookmarks.length === 0 ? (
        <ReadingState kind="empty" title="No saved lessons yet." message="Bookmark a lesson while browsing or reading, and it will be easy to find here." />
      ) : null}
      {!loading && !failed && bookmarks.length > 0 && visibleBookmarks.length === 0 ? (
        <ReadingState kind="empty" title="No saved lessons for this subject." message="Choose another subject or bookmark a lesson from its lesson list." />
      ) : null}
      {!loading && !failed ? visibleBookmarks.map(({ lesson }) => (
        <LessonCard
          key={lesson.id}
          lesson={lesson}
          onPress={() => navigation.navigate('Lesson', { lessonId: lesson.id })}
          isBookmarked
          bookmarkLoading={savingLessonId === lesson.id}
          onToggleBookmark={() => removeBookmark(lesson.id)}
        />
      )) : null}
      {!loading && !failed && bookmarks.length > 0 ? (
        <Text style={styles.note}>Saved lessons stay linked to your READSMART account.</Text>
      ) : null}
    </Screen>
  );
}

function FilterChip({ title, selected, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipSelected: { backgroundColor: colors.greenLight, borderColor: '#D8E8DC' },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  chipTextSelected: { color: colors.greenDark },
  note: { textAlign: 'center', color: colors.muted, fontSize: 11, lineHeight: 17 },
  pressed: { opacity: 0.78 },
});
