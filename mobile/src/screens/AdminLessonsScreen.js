import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../components/Screen';
import { ReadingState } from '../components/ReadingComponents';
import { AdminButton, AdminCard, AdminField, AdminHeader, AdminInlineActions, AdminSectionTitle } from '../components/AdminComponents';
import { api } from '../services/api';
import { colors } from '../theme';

const blankLesson = { title: '', lessonNumber: '', overview: '', lesson: '', discussion: '', example: '', keyConcepts: '', keyTakeaway: '' };

export function AdminLessonsScreen({ navigation, route }) {
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState(route.params?.subjectId || '');
  const [lessons, setLessons] = useState([]);
  const [form, setForm] = useState(blankLesson);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    api.adminGetSubjects().then((result) => {
      if (!active) return;
      const available = result.subjects || [];
      setSubjects(available);
      const preferred = route.params?.subjectId;
      setSubjectId((current) => (preferred && available.some((subject) => subject.id === preferred)
        ? preferred
        : (current && available.some((subject) => subject.id === current) ? current : available[0]?.id || '')));
      setFailed(false);
    }).catch(() => { if (active) setFailed(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [route.params?.subjectId, reload]));

  useEffect(() => {
    if (!subjectId) { setLessons([]); return undefined; }
    let active = true;
    setLessonsLoading(true);
    api.adminGetLessons(subjectId)
      .then((result) => { if (active) setLessons(result.lessons || []); })
      .catch((error) => { if (active) { setLessons([]); setMessage(error.message || 'Unable to load lessons.'); } })
      .finally(() => { if (active) setLessonsLoading(false); });
    return () => { active = false; };
  }, [subjectId, reload]);

  function edit(lesson) {
    setEditingId(lesson.id);
    setForm({
      title: lesson.title,
      lessonNumber: String(lesson.lessonNumber),
      overview: lesson.overview || '',
      lesson: lesson.lesson || '',
      discussion: lesson.discussion || '',
      example: lesson.example || '',
      keyConcepts: (lesson.keyConcepts || []).join('\n'),
      keyTakeaway: lesson.keyTakeaway || '',
    });
    setMessage('');
  }

  function reset() { setEditingId(null); setForm(blankLesson); setMessage(''); }

  async function save() {
    setSaving(true);
    setMessage('');
    const body = {
      title: form.title.trim(), lessonNumber: Number(form.lessonNumber), overview: form.overview.trim(),
      lesson: form.lesson.trim(), discussion: form.discussion.trim(), example: form.example.trim(),
      keyConcepts: form.keyConcepts.split(/\r?\n/u).map((item) => item.trim()).filter(Boolean), keyTakeaway: form.keyTakeaway.trim(),
      contentStatus: 'ready',
    };
    try {
      if (editingId) await api.adminUpdateLesson(editingId, body);
      else await api.adminCreateLesson(subjectId, body);
      reset();
      setReload((value) => value + 1);
    } catch (error) {
      setMessage(error.message || 'Unable to save lesson. Check the title, lesson number, and lesson content.');
    } finally { setSaving(false); }
  }

  async function toggle(lesson) {
    setMessage('');
    try {
      await api.adminSetLessonPublished(lesson.id, !lesson.isPublished);
      setReload((value) => value + 1);
    } catch (error) { setMessage(error.message || 'Unable to change lesson publication.'); }
  }

  return (
    <Screen>
      <AdminHeader title="Lessons" subtitle="Edit lesson content and publishing without deleting student records." onBack={() => navigation.goBack()} />
      <AdminSectionTitle>Select subject</AdminSectionTitle>
      {loading ? <ReadingState kind="loading" title="Loading subjects…" /> : null}
      {!loading && failed ? <ReadingState kind="error" title="Unable to load subjects." message="Check the server connection." onRetry={() => setReload((value) => value + 1)} /> : null}
      <View style={styles.subjectList}>
        {subjects.map((subject) => (
          <Pressable key={subject.id} accessibilityRole="button" onPress={() => { setSubjectId(subject.id); reset(); }} style={[styles.subjectChip, subject.id === subjectId && styles.selectedChip]}>
            <Text style={[styles.subjectChipText, subject.id === subjectId && styles.selectedChipText]}>{subject.code} · {subject.name}</Text>
          </Pressable>
        ))}
      </View>

      {subjectId ? <>
        <AdminSectionTitle hint="Lesson content and lesson number are validated by the API.">{editingId ? 'Edit lesson' : 'Add lesson'}</AdminSectionTitle>
        <AdminCard>
          <AdminField label="Lesson title" value={form.title} onChangeText={(title) => setForm((f) => ({ ...f, title }))} />
          <AdminField label="Lesson number" value={form.lessonNumber} onChangeText={(lessonNumber) => setForm((f) => ({ ...f, lessonNumber }))} keyboardType="number-pad" />
          <AdminField label="Overview" value={form.overview} onChangeText={(overview) => setForm((f) => ({ ...f, overview }))} multiline />
          <AdminField label="Lesson / introduction (required)" value={form.lesson} onChangeText={(lesson) => setForm((f) => ({ ...f, lesson }))} multiline />
          <AdminField label="Discussion" value={form.discussion} onChangeText={(discussion) => setForm((f) => ({ ...f, discussion }))} multiline />
          <AdminField label="Example" value={form.example} onChangeText={(example) => setForm((f) => ({ ...f, example }))} multiline />
          <AdminField label="Key concepts (one per line)" value={form.keyConcepts} onChangeText={(keyConcepts) => setForm((f) => ({ ...f, keyConcepts }))} multiline />
          <AdminField label="Key takeaway" value={form.keyTakeaway} onChangeText={(keyTakeaway) => setForm((f) => ({ ...f, keyTakeaway }))} multiline />
          {message ? <Text accessibilityRole="alert" style={styles.message}>{message}</Text> : null}
          <AdminInlineActions>
            <AdminButton title={saving ? 'Saving…' : editingId ? 'Save changes' : 'Add lesson'} onPress={save} disabled={saving || !form.title.trim() || !form.lesson.trim() || !form.lessonNumber.trim()} />
            {editingId ? <AdminButton title="Cancel" secondary onPress={reset} disabled={saving} /> : null}
          </AdminInlineActions>
        </AdminCard>
      </> : null}

      <AdminSectionTitle>Lessons in this subject</AdminSectionTitle>
      {lessonsLoading ? <ReadingState kind="loading" title="Loading lessons…" /> : null}
      {!lessonsLoading && subjectId && lessons.length === 0 ? <ReadingState kind="empty" title="No lessons for this subject yet." /> : null}
      {!lessonsLoading ? lessons.map((lesson) => (
        <AdminCard key={lesson.id} style={styles.lessonCard}>
          <Text style={styles.lessonTitle}>Lesson {lesson.lessonNumber}: {lesson.title}</Text>
          <Text style={styles.meta}>{lesson.isPublished ? 'Published' : 'Unpublished'} · {lesson.contentStatus === 'ready' ? 'Content ready' : 'Content pending'}</Text>
          {lesson.overview ? <Text style={styles.overview} numberOfLines={3}>{lesson.overview}</Text> : null}
          <AdminInlineActions>
            <AdminButton title="Edit" secondary onPress={() => edit(lesson)} />
            <AdminButton title={lesson.isPublished ? 'Unpublish' : 'Publish'} secondary onPress={() => toggle(lesson)} />
            <AdminButton title="Questions" onPress={() => navigation.navigate('AdminQuestions', { lessonId: lesson.id, lessonTitle: lesson.title })} />
            <AdminButton title="Writing activity" onPress={() => navigation.navigate('AdminWritingActivities', { lessonId: lesson.id, lessonTitle: lesson.title })} />
          </AdminInlineActions>
        </AdminCard>
      )) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  subjectList: { gap: 7 },
  subjectChip: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 10, borderRadius: 12 },
  selectedChip: { borderColor: colors.green, backgroundColor: colors.greenLight },
  subjectChipText: { color: colors.ink, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  selectedChipText: { color: colors.greenDark, fontWeight: '800' },
  message: { color: '#9E3C36', fontSize: 12, lineHeight: 18 },
  lessonCard: { gap: 8 },
  lessonTitle: { color: colors.ink, fontSize: 13, lineHeight: 19, fontWeight: '800' },
  meta: { color: colors.greenDark, fontSize: 10, fontWeight: '700' },
  overview: { color: colors.muted, fontSize: 11, lineHeight: 16 },
});
