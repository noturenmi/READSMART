import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AssessmentButton } from '../components/AssessmentComponents';
import { Card, Screen } from '../components/Screen';
import { ReadingHeader, ReadingState } from '../components/ReadingComponents';
import { api } from '../services/api';
import { colors } from '../theme';

const criteria = [
  ['grammar', 'Grammar'],
  ['vocabulary', 'Vocabulary'],
  ['organization', 'Organization'],
  ['coherence', 'Coherence'],
  ['developmentOfIdeas', 'Development of Ideas'],
];

function historyRequest(adminUserId, page) {
  return adminUserId
    ? api.adminGetWritingSubmissionHistory(adminUserId, page)
    : api.getMyWritingSubmissionHistory(page);
}

function detailRequest(adminUserId, submissionId) {
  return adminUserId
    ? api.adminGetWritingSubmission(adminUserId, submissionId)
    : api.getMyWritingSubmission(submissionId);
}

function formatDate(value) {
  if (!value) return 'Submission date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Submission date unavailable' : date.toLocaleString();
}

function historySubtitle(item) {
  const pieces = [];
  if (item.lesson?.subject?.code) pieces.push(item.lesson.subject.code);
  if (item.lesson?.title) pieces.push(item.lesson.title);
  return pieces.length ? pieces.join(' · ') : 'Lesson details unavailable';
}

export function WritingHistoryScreen({ navigation, route }) {
  const { adminUserId, userName } = route.params || {};
  const [submissions, setSubmissions] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState('');
  const [reload, setReload] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    setMoreError('');
    historyRequest(adminUserId, 1)
      .then((data) => {
        if (!active) return;
        setSubmissions(Array.isArray(data.submissions) ? data.submissions : []);
        setPagination(data.pagination || null);
      })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [adminUserId, reload]));

  async function loadMore() {
    if (!pagination || loadingMore || pagination.page >= pagination.totalPages) return;
    setLoadingMore(true);
    setMoreError('');
    try {
      const data = await historyRequest(adminUserId, pagination.page + 1);
      setSubmissions((current) => [...current, ...(Array.isArray(data.submissions) ? data.submissions : [])]);
      setPagination(data.pagination || pagination);
    } catch (error) {
      setMoreError(error.message || 'Unable to load more submissions. Please try again.');
    } finally {
      setLoadingMore(false);
    }
  }

  const detailRoute = adminUserId ? 'AdminWritingSubmissionDetail' : 'WritingSubmissionDetail';
  return (
    <Screen>
      <ReadingHeader
        title={adminUserId ? 'Student Writing History' : 'My Writing Submissions'}
        subtitle={adminUserId ? `${userName || 'Student'}’s saved submissions` : 'Review your previous responses and feedback.'}
        eyebrow={adminUserId ? 'STUDENT RECORDS' : 'WRITING ENHANCEMENT'}
        onBack={() => navigation.goBack()}
      />
      {loading ? <ReadingState kind="loading" title="Loading writing submissions…" /> : null}
      {!loading && failed ? (
        <ReadingState
          kind="error"
          title="Unable to load writing history."
          message="Please check your connection and try again."
          onRetry={() => setReload((value) => value + 1)}
        />
      ) : null}
      {!loading && !failed && submissions.length === 0 ? (
        <ReadingState
          kind="empty"
          title={adminUserId ? 'No saved writing submissions.' : 'No writing submissions yet.'}
          message={adminUserId ? 'This student’s submitted responses will appear here.' : 'After you submit a writing activity, you can review its response and feedback here.'}
        />
      ) : null}
      {!loading && !failed ? submissions.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityLabel={`Open writing submission for ${item.writingActivity?.title || 'writing activity'}`}
          onPress={() => navigation.navigate(detailRoute, {
            submissionId: item.id,
            adminUserId,
            userName,
          })}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Card style={styles.historyCard}>
            <View style={styles.cardHeader}>
              <View style={styles.activityIcon}><Ionicons name="document-text-outline" size={19} color={colors.greenDark} /></View>
              <View style={styles.cardCopy}>
                <Text style={styles.activityTitle}>{item.writingActivity?.title || 'Writing activity unavailable'}</Text>
                <Text style={styles.lesson}>{historySubtitle(item)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </View>
            <Text style={styles.date}>{formatDate(item.submittedAt)}</Text>
            <Text style={styles.preview} numberOfLines={3}>
              {item.responsePreview || 'Submitted text preview unavailable.'}
            </Text>
            <View style={styles.resultRow}>
              <Text style={[styles.result, item.score ? styles.resultAvailable : styles.resultMissing]}>
                {item.score
                  ? `${item.score.totalScore} / ${item.score.maxScore}${item.score.percentage == null ? '' : ` · ${item.score.percentage}%`}`
                  : 'Assessment result unavailable'}
              </Text>
              <Text style={styles.wordCount}>{Number.isInteger(item.wordCount) ? `${item.wordCount} words` : 'Word count unavailable'}</Text>
            </View>
            {item.feedback ? <Text style={styles.feedbackPreview} numberOfLines={2}>{item.feedback}</Text> : null}
          </Card>
        </Pressable>
      )) : null}
      {!loading && !failed && pagination?.page < pagination?.totalPages ? (
        <>
          {moreError ? <Text accessibilityRole="alert" style={styles.error}>{moreError}</Text> : null}
          <AssessmentButton title={loadingMore ? 'Loading…' : 'Load More'} disabled={loadingMore} variant="secondary" onPress={loadMore} />
        </>
      ) : null}
    </Screen>
  );
}

export function WritingSubmissionDetailScreen({ navigation, route }) {
  const { submissionId, adminUserId, userName } = route.params;
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    detailRequest(adminUserId, submissionId)
      .then((data) => { if (active) setSubmission(data.submission || null); })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [adminUserId, submissionId, reload]);

  return (
    <Screen>
      <ReadingHeader
        title="Writing Submission"
        subtitle={adminUserId ? `${userName || 'Student'} · ${submission?.writingActivity?.title || 'Saved response'}` : (submission?.writingActivity?.title || 'Saved response')}
        eyebrow={adminUserId ? 'STUDENT RECORD' : 'YOUR WRITING HISTORY'}
        onBack={() => navigation.goBack()}
      />
      {loading ? <ReadingState kind="loading" title="Loading submission…" /> : null}
      {!loading && failed ? (
        <ReadingState
          kind="error"
          title="Unable to load this submission."
          message="It may no longer be available. Please try again."
          onRetry={() => setReload((value) => value + 1)}
        />
      ) : null}
      {!loading && !failed && submission ? (
        <>
          <Card style={styles.detailMeta}>
            <Text style={styles.detailTitle}>{submission.writingActivity?.title || 'Writing activity unavailable'}</Text>
            <Text style={styles.lesson}>{historySubtitle(submission)}</Text>
            {submission.writingActivity?.prompt ? (
              <View style={styles.promptBlock}>
                <Text style={styles.sectionLabel}>ASSOCIATED PROMPT</Text>
                <Text style={styles.prompt}>{submission.writingActivity.prompt}</Text>
              </View>
            ) : null}
            <Text style={styles.date}>{formatDate(submission.submittedAt)}</Text>
            {Number.isInteger(submission.wordCount) ? <Text style={styles.wordCount}>{submission.wordCount} words submitted</Text> : null}
          </Card>

          <Card style={styles.detailCard}>
            <Text style={styles.sectionTitle}>Original writing submission</Text>
            <Text selectable style={styles.responseText}>{submission.response || 'Submitted text is unavailable.'}</Text>
          </Card>

          <Card style={styles.detailCard}>
            <Text style={styles.sectionTitle}>Assessment results</Text>
            {submission.score ? (
              <>
                <View style={styles.scoreRow}>
                  <Text style={styles.totalScore}>{submission.score.totalScore} / {submission.score.maxScore}</Text>
                  {submission.score.percentage == null ? null : <Text style={styles.percentage}>{submission.score.percentage}%</Text>}
                </View>
                {submission.rubricScores ? criteria.map(([key, label]) => (
                  <View key={key} style={styles.criterion}>
                    <View style={styles.criterionTop}>
                      <Text style={styles.criterionName}>{label}</Text>
                      <Text style={styles.criterionScore}>{Number.isInteger(submission.rubricScores[key]) ? `${submission.rubricScores[key]} / 5` : 'Score unavailable'}</Text>
                    </View>
                    {submission.criterionFeedback?.[key] ? <Text style={styles.criterionFeedback}>{submission.criterionFeedback[key]}</Text> : null}
                  </View>
                )) : <Text style={styles.body}>Rubric breakdown is unavailable for this submission.</Text>}
              </>
            ) : <Text style={styles.body}>Assessment result unavailable for this submission.</Text>}
          </Card>

          <Card style={styles.detailCard}>
            <Text style={styles.sectionTitle}>Writing feedback</Text>
            <Text style={styles.body}>{submission.feedback || 'Writing feedback is unavailable for this submission.'}</Text>
          </Card>

          {submission.aiFeedback ? <AIFeedbackCard feedback={submission.aiFeedback} /> : null}
        </>
      ) : null}
    </Screen>
  );
}

function AIFeedbackCard({ feedback }) {
  const groups = [
    ['Strengths', feedback.strengths],
    ['Areas for Improvement', feedback.areasForImprovement],
    ['Suggestions', feedback.suggestions],
  ];
  return (
    <Card style={styles.detailCard}>
      <Text style={styles.sectionTitle}>AI-Assisted Writing Feedback</Text>
      {groups.map(([title, items]) => Array.isArray(items) && items.length ? (
        <View key={title} style={styles.feedbackGroup}>
          <Text style={styles.feedbackHeading}>{title}</Text>
          {items.map((item, index) => <Text key={`${title}-${index}`} style={styles.body}>• {item}</Text>)}
        </View>
      ) : null)}
      {feedback.encouragement ? <Text style={styles.body}>{feedback.encouragement}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.78 },
  historyCard: { gap: 9, padding: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  activityIcon: { width: 39, height: 39, borderRadius: 13, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1, minWidth: 0, gap: 3 },
  activityTitle: { color: colors.ink, fontSize: 14, lineHeight: 19, fontWeight: '800' },
  lesson: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  date: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  preview: { color: colors.ink, fontSize: 12, lineHeight: 18 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  result: { fontSize: 12, lineHeight: 17, fontWeight: '800' },
  resultAvailable: { color: colors.greenDark },
  resultMissing: { color: colors.muted, fontWeight: '600' },
  wordCount: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  feedbackPreview: { color: colors.greenDark, fontSize: 11, lineHeight: 16 },
  error: { color: '#9E3C36', backgroundColor: '#FCECEA', borderRadius: 12, padding: 12, fontSize: 12, lineHeight: 18 },
  detailMeta: { gap: 8, backgroundColor: colors.greenLight, borderColor: '#D8E8DC' },
  detailTitle: { color: colors.greenDark, fontSize: 16, lineHeight: 22, fontWeight: '800' },
  promptBlock: { borderTopWidth: 1, borderTopColor: '#D8E8DC', paddingTop: 9, gap: 4 },
  sectionLabel: { color: colors.green, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  prompt: { color: colors.ink, fontSize: 12, lineHeight: 19 },
  detailCard: { gap: 11 },
  sectionTitle: { color: colors.greenDark, fontSize: 16, lineHeight: 22, fontWeight: '800' },
  responseText: { color: colors.ink, fontSize: 14, lineHeight: 23, flexShrink: 1 },
  body: { color: colors.ink, fontSize: 12, lineHeight: 19 },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  totalScore: { color: colors.greenDark, fontSize: 22, fontWeight: '800' },
  percentage: { color: colors.green, fontSize: 16, fontWeight: '800' },
  criterion: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 7, gap: 4 },
  criterionTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  criterionName: { flex: 1, color: colors.ink, fontSize: 12, fontWeight: '700' },
  criterionScore: { color: colors.greenDark, fontSize: 12, fontWeight: '800' },
  criterionFeedback: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  feedbackGroup: { gap: 4 },
  feedbackHeading: { color: colors.ink, fontSize: 12, fontWeight: '800' },
});
