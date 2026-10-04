import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../components/Screen';
import { ReadingState } from '../components/ReadingComponents';
import { AdminButton, AdminCard, AdminField, AdminHeader, AdminInlineActions, AdminSectionTitle } from '../components/AdminComponents';
import { api } from '../services/api';
import { colors } from '../theme';

const blankActivity = { title: '', prompt: '', instructions: '', minimumWords: '100', maximumWords: '250' };

export function AdminWritingActivitiesScreen({ navigation, route }) {
  const { lessonId, lessonTitle } = route.params || {};
  const [activity, setActivity] = useState(null);
  const [exists, setExists] = useState(false);
  const [form, setForm] = useState(blankActivity);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);

  const load = useCallback(async () => {
    if (!lessonId) { setLoading(false); setFailed(true); return; }
    setLoading(true);
    setFailed(false);
    try {
      const result = await api.adminGetWritingActivity(lessonId);
      const current = result.activity;
      setActivity(current);
      setExists(Boolean(current));
      if (current) setForm({ title: current.title, prompt: current.prompt, instructions: current.instructions, minimumWords: String(current.minimumWords), maximumWords: String(current.maximumWords) });
      else setForm(blankActivity);
    } catch { setFailed(true); }
    finally { setLoading(false); }
  }, [lessonId]);

  useFocusEffect(useCallback(() => { load(); }, [load, reload]));

  async function save() {
    setSaving(true);
    setMessage('');
    const body = {
      title: form.title.trim(), prompt: form.prompt.trim(), instructions: form.instructions.trim(),
      minimumWords: Number(form.minimumWords), maximumWords: Number(form.maximumWords),
    };
    try {
      if (exists && activity) await api.adminUpdateWritingActivity(activity.id, body);
      else await api.adminCreateWritingActivity(lessonId, body);
      setReload((value) => value + 1);
    } catch (error) { setMessage(error.message || 'Unable to save writing activity. Check the prompt and word range.'); }
    finally { setSaving(false); }
  }

  async function toggle() {
    if (!activity) return;
    setMessage('');
    try {
      await api.adminSetWritingActivityPublished(activity.id, !activity.isPublished);
      setReload((value) => value + 1);
    } catch (error) { setMessage(error.message || 'Unable to change publication.'); }
  }

  return (
    <Screen>
      <AdminHeader title="Writing activity" subtitle={lessonTitle || 'Manage the activity and publication status for this lesson.'} onBack={() => navigation.goBack()} />
      {loading ? <ReadingState kind="loading" title="Loading writing activity…" /> : null}
      {!loading && failed ? <ReadingState kind="error" title="Unable to load writing activity." message="Open this screen from a lesson and check the connection." onRetry={() => setReload((value) => value + 1)} /> : null}
      {!loading && !failed ? <>
        <AdminSectionTitle hint="One activity is supported per lesson. Existing student submissions are retained when an activity is unpublished.">{activity ? 'Edit activity' : 'Add activity'}</AdminSectionTitle>
        <AdminCard>
          <AdminField label="Activity title" value={form.title} onChangeText={(title) => setForm((f) => ({ ...f, title }))} />
          <AdminField label="Writing prompt" value={form.prompt} onChangeText={(prompt) => setForm((f) => ({ ...f, prompt }))} multiline />
          <AdminField label="Instructions" value={form.instructions} onChangeText={(instructions) => setForm((f) => ({ ...f, instructions }))} multiline />
          <View style={styles.row}>
            <View style={styles.half}><AdminField label="Minimum words" value={form.minimumWords} onChangeText={(minimumWords) => setForm((f) => ({ ...f, minimumWords }))} keyboardType="number-pad" /></View>
            <View style={styles.half}><AdminField label="Maximum words" value={form.maximumWords} onChangeText={(maximumWords) => setForm((f) => ({ ...f, maximumWords }))} keyboardType="number-pad" /></View>
          </View>
          <Text style={styles.rubricHint}>The existing five-criterion rubric is reused. Its server-side scoring behavior is unchanged.</Text>
          {message ? <Text accessibilityRole="alert" style={styles.message}>{message}</Text> : null}
          <AdminInlineActions>
            <AdminButton title={saving ? 'Saving…' : activity ? 'Save changes' : 'Create activity'} onPress={save} disabled={saving || !form.title.trim() || !form.prompt.trim() || !form.instructions.trim() || !form.minimumWords.trim() || !form.maximumWords.trim()} />
            {activity ? <AdminButton title={activity.isPublished ? 'Unpublish' : 'Publish'} secondary onPress={toggle} /> : null}
          </AdminInlineActions>
          {activity ? <Text style={styles.status}>Status: {activity.isPublished ? 'Published' : 'Unpublished'}</Text> : null}
          {activity?.criteria?.length ? (
            <View style={styles.criteria}>
              <Text style={styles.criteriaTitle}>Rubric criteria</Text>
              {activity.criteria.map((criterion) => <Text key={criterion.key} style={styles.criterion}>• {criterion.label}</Text>)}
            </View>
          ) : null}
        </AdminCard>
      </> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  rubricHint: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  message: { color: '#9E3C36', fontSize: 12, lineHeight: 18 },
  status: { color: colors.greenDark, fontSize: 11, fontWeight: '700' },
  criteria: { gap: 5, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 11 },
  criteriaTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  criterion: { color: colors.muted, fontSize: 11, lineHeight: 16 },
});
