import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../components/Screen';
import { ReadingState } from '../components/ReadingComponents';
import { AdminButton, AdminCard, AdminField, AdminHeader, AdminInlineActions, AdminSectionTitle } from '../components/AdminComponents';
import { api } from '../services/api';
import { colors } from '../theme';

const questionTypes = ['key_idea', 'vocabulary', 'inference', 'interpretation', 'evaluation'];
const blankQuestion = { question: '', questionType: 'key_idea', choices: ['', '', '', ''], correctAnswer: '0', explanation: '', points: '1', order: '', isPublished: false };

export function AdminQuestionsScreen({ navigation, route }) {
  const { lessonId, lessonTitle } = route.params || {};
  const [questions, setQuestions] = useState([]);
  const [form, setForm] = useState(blankQuestion);
  const [editingId, setEditingId] = useState(null);
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
      const result = await api.adminGetQuestions(lessonId);
      setQuestions(result.questions || []);
    } catch { setFailed(true); }
    finally { setLoading(false); }
  }, [lessonId]);

  useFocusEffect(useCallback(() => { load(); }, [load, reload]));

  function edit(question) {
    setEditingId(question.id);
    setForm({
      question: question.question,
      questionType: question.questionType,
      choices: question.choices,
      correctAnswer: String(question.correctAnswer),
      explanation: question.explanation,
      points: String(question.points),
      order: String(question.order),
      isPublished: question.isPublished,
    });
    setMessage('');
  }

  function reset() { setEditingId(null); setForm(blankQuestion); setMessage(''); }

  async function save() {
    setSaving(true);
    setMessage('');
    const body = {
      question: form.question.trim(), questionType: form.questionType,
      choices: form.choices.map((choice) => choice.trim()),
      correctAnswer: Number(form.correctAnswer), explanation: form.explanation.trim(),
      points: Number(form.points), order: Number(form.order), isPublished: form.isPublished,
    };
    try {
      if (editingId) await api.adminUpdateQuestion(editingId, body);
      else await api.adminCreateQuestion(lessonId, body);
      reset();
      setReload((n) => n + 1);
    } catch (error) { setMessage(error.message || 'Unable to save question. Check all fields and the correct-choice index.'); }
    finally { setSaving(false); }
  }

  async function toggle(question) {
    setMessage('');
    try {
      await api.adminSetQuestionPublished(question.id, !question.isPublished);
      setReload((n) => n + 1);
    } catch (error) { setMessage(error.message || 'Unable to change question publication.'); }
  }

  return (
    <Screen>
      <AdminHeader title="Reading questions" subtitle={lessonTitle || 'Manage this lesson assessment.'} onBack={() => navigation.goBack()} />
      <AdminSectionTitle hint="Correct-answer index uses zero-based choices: 1, 2, 3, or 4.">{editingId ? 'Edit question' : 'Add question'}</AdminSectionTitle>
      <AdminCard>
        <AdminField label="Question text" value={form.question} onChangeText={(question) => setForm((f) => ({ ...f, question }))} multiline />
        <Text style={styles.label}>Question type</Text>
        <View style={styles.types}>
          {questionTypes.map((type) => (
            <Pressable key={type} accessibilityRole="button" onPress={() => setForm((f) => ({ ...f, questionType: type }))} style={[styles.type, form.questionType === type && styles.selectedType]}>
              <Text style={[styles.typeText, form.questionType === type && styles.selectedTypeText]}>{type.replaceAll('_', ' ')}</Text>
            </Pressable>
          ))}
        </View>
        {form.choices.map((choice, index) => (
          <AdminField key={index} label={`Choice ${index + 1}`} value={choice} onChangeText={(value) => setForm((f) => ({ ...f, choices: f.choices.map((item, i) => i === index ? value : item) }))} />
        ))}
        <AdminField label="Correct choice index (1–4)" value={form.correctAnswer} onChangeText={(correctAnswer) => setForm((f) => ({ ...f, correctAnswer }))} keyboardType="number-pad" />
        <AdminField label="Explanation" value={form.explanation} onChangeText={(explanation) => setForm((f) => ({ ...f, explanation }))} multiline />
        <View style={styles.row}>
          <View style={styles.half}><AdminField label="Points" value={form.points} onChangeText={(points) => setForm((f) => ({ ...f, points }))} keyboardType="number-pad" /></View>
          <View style={styles.half}><AdminField label="Question order" value={form.order} onChangeText={(order) => setForm((f) => ({ ...f, order }))} keyboardType="number-pad" /></View>
        </View>
        {message ? <Text accessibilityRole="alert" style={styles.message}>{message}</Text> : null}
        <AdminInlineActions>
          <AdminButton title={saving ? 'Saving…' : editingId ? 'Save changes' : 'Add question'} onPress={save} disabled={saving || !form.question.trim() || form.choices.some((choice) => !choice.trim()) || !form.order.trim() || !form.explanation.trim()} />
          {editingId ? <AdminButton title="Cancel" secondary onPress={reset} disabled={saving} /> : null}
        </AdminInlineActions>
      </AdminCard>

      <AdminSectionTitle>Questions ({questions.length})</AdminSectionTitle>
      {loading ? <ReadingState kind="loading" title="Loading questions…" /> : null}
      {!loading && failed ? <ReadingState kind="error" title="Unable to load questions." message="Open this screen from a lesson and check the server connection." onRetry={() => setReload((n) => n + 1)} /> : null}
      {!loading && !failed && questions.length === 0 ? <ReadingState kind="empty" title="No questions for this lesson yet." /> : null}
      {!loading ? questions.map((question) => (
        <AdminCard key={question.id} style={styles.questionCard}>
          <Text style={styles.questionText}>{question.order}. {question.question}</Text>
          <Text style={styles.meta}>{question.questionType.replaceAll('_', ' ')} · {question.points} pt · {question.isPublished ? 'Published' : 'Unpublished'}</Text>
          {question.choices.map((choice, index) => (
            <Text key={`${question.id}-${index}`} style={[styles.choice, index === question.correctAnswer && styles.correct]}>{String.fromCharCode(65 + index)}. {choice}{index === question.correctAnswer ? '  ✓ Correct' : ''}</Text>
          ))}
          <Text style={styles.explanation}>Explanation: {question.explanation}</Text>
          <AdminInlineActions>
            <AdminButton title="Edit" secondary onPress={() => edit(question)} />
            <AdminButton title={question.isPublished ? 'Unpublish' : 'Publish'} secondary onPress={() => toggle(question)} />
          </AdminInlineActions>
        </AdminCard>
      )) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  type: { borderRadius: 11, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: colors.surface },
  selectedType: { borderColor: colors.green, backgroundColor: colors.greenLight },
  typeText: { color: colors.muted, fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  selectedTypeText: { color: colors.greenDark },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  message: { color: '#9E3C36', fontSize: 12, lineHeight: 18 },
  questionCard: { gap: 7 },
  questionText: { color: colors.ink, fontSize: 13, lineHeight: 19, fontWeight: '800' },
  meta: { color: colors.greenDark, fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  choice: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  correct: { color: colors.greenDark, fontWeight: '800' },
  explanation: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 2 },
});
