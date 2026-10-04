import React, { useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../components/Screen';
import { ReadingState } from '../components/ReadingComponents';
import { AdminButton, AdminCard, AdminField, AdminHeader, AdminInlineActions, AdminSectionTitle } from '../components/AdminComponents';
import { api } from '../services/api';
import { colors } from '../theme';

const emptyForm = { name: '', code: '', description: '', order: '' };

export function AdminSubjectsScreen({ navigation }) {
  const [subjects, setSubjects] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const result = await api.adminGetSubjects();
      setSubjects(result.subjects || []);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load, reload]));

  function edit(subject) {
    setEditingId(subject.id);
    setForm({ name: subject.name, code: subject.code, description: subject.description || '', order: String(subject.order) });
    setMessage('');
  }

  function reset() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage('');
  }

  async function save() {
    setSaving(true);
    setMessage('');
    const body = { name: form.name.trim(), code: form.code.trim().toUpperCase(), description: form.description.trim(), order: Number(form.order) };
    try {
      if (editingId) await api.adminUpdateSubject(editingId, body);
      else await api.adminCreateSubject(body);
      reset();
      setReload((value) => value + 1);
    } catch (error) {
      setMessage(error.message || 'Unable to save this subject.');
    } finally {
      setSaving(false);
    }
  }

  async function toggle(subject) {
    setMessage('');
    try {
      await api.adminSetSubjectActive(subject.id, !subject.isActive);
      setReload((value) => value + 1);
    } catch (error) {
      setMessage(error.message || 'Unable to update publication.');
    }
  }

  return (
    <Screen>
      <AdminHeader title="Subjects" subtitle="Manage the existing subject catalog and student visibility." onBack={() => navigation.goBack()} />
      <AdminSectionTitle hint="Name and subject code must be unique.">{editingId ? 'Edit subject' : 'Add subject'}</AdminSectionTitle>
      <AdminCard>
        <AdminField label="Subject name" value={form.name} onChangeText={(name) => setForm((f) => ({ ...f, name }))} />
        <AdminField label="Code (2–8 letters)" value={form.code} onChangeText={(code) => setForm((f) => ({ ...f, code }))} />
        <AdminField label="Description" value={form.description} onChangeText={(description) => setForm((f) => ({ ...f, description }))} multiline />
        <AdminField label="Display order" value={form.order} onChangeText={(order) => setForm((f) => ({ ...f, order }))} keyboardType="number-pad" />
        {message ? <Text accessibilityRole="alert" style={styles.message}>{message}</Text> : null}
        <AdminInlineActions>
          <AdminButton title={saving ? 'Saving…' : editingId ? 'Save changes' : 'Add subject'} onPress={save} disabled={saving || !form.name.trim() || !form.code.trim() || !form.order.trim()} />
          {editingId ? <AdminButton title="Cancel" secondary onPress={reset} disabled={saving} /> : null}
        </AdminInlineActions>
      </AdminCard>
      <AdminSectionTitle>Subject catalog</AdminSectionTitle>
      {loading ? <ReadingState kind="loading" title="Loading subjects…" /> : null}
      {!loading && failed ? <ReadingState kind="error" title="Unable to load subjects." message="Please check the server connection." onRetry={() => setReload((value) => value + 1)} /> : null}
      {!loading && !failed && subjects.length === 0 ? <ReadingState kind="empty" title="No subjects found." /> : null}
      {!loading && !failed ? subjects.map((subject) => (
        <AdminCard key={subject.id} style={styles.subjectCard}>
          <Text style={styles.name}>{subject.name}</Text>
          <Text style={styles.meta}>{subject.code} · {subject.totalLessons} lessons · {subject.isActive ? 'Published' : 'Unpublished'}</Text>
          {subject.description ? <Text style={styles.description}>{subject.description}</Text> : null}
          <AdminInlineActions>
            <AdminButton title="Edit" secondary onPress={() => edit(subject)} />
            <AdminButton title={subject.isActive ? 'Unpublish' : 'Publish'} secondary onPress={() => toggle(subject)} />
            <AdminButton title="Manage lessons" onPress={() => navigation.navigate('AdminLessons', { subjectId: subject.id })} />
          </AdminInlineActions>
        </AdminCard>
      )) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  message: { color: '#9E3C36', fontSize: 12, lineHeight: 18 },
  subjectCard: { gap: 8 },
  name: { color: colors.ink, fontSize: 14, lineHeight: 20, fontWeight: '800' },
  meta: { color: colors.greenDark, fontSize: 11, fontWeight: '700' },
  description: { color: colors.muted, fontSize: 12, lineHeight: 18 },
});
