import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AssessmentButton } from '../components/AssessmentComponents';
import { Card, Screen } from '../components/Screen';
import { ReadingHeader, ReadingState } from '../components/ReadingComponents';
import { api } from '../services/api';
import { colors } from '../theme';

const PAGE_SIZE = 25;
const notificationStyles = {
  assessment_result: { icon: 'document-text-outline', label: 'ASSESSMENT RESULT', color: colors.blue },
  writing_feedback: { icon: 'create-outline', label: 'WRITING FEEDBACK', color: colors.green },
  learning_reminder: { icon: 'calendar-outline', label: 'LEARNING REMINDER', color: '#A67513' },
  learning_milestone: { icon: 'checkmark-circle-outline', label: 'LEARNING MILESTONE', color: colors.greenDark },
};

function formatDate(value) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString();
}

export function NotificationCenterScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reload, setReload] = useState(0);

  const loadFirstPage = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setFailed(false);
    try {
      const result = await api.getNotifications(1, PAGE_SIZE);
      setNotifications(Array.isArray(result.notifications) ? result.notifications : []);
      setPagination(result.pagination || null);
      setUnreadCount(Number.isInteger(result.unreadCount) ? result.unreadCount : 0);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadFirstPage();
  }, [loadFirstPage, reload]));

  async function loadMore() {
    if (!pagination || loadingMore || pagination.page >= pagination.totalPages) return;
    setLoadingMore(true);
    try {
      const result = await api.getNotifications(pagination.page + 1, PAGE_SIZE);
      setNotifications((current) => [...current, ...(Array.isArray(result.notifications) ? result.notifications : [])]);
      setPagination(result.pagination || pagination);
      setUnreadCount(Number.isInteger(result.unreadCount) ? result.unreadCount : unreadCount);
    } catch {
      Alert.alert('Unable to load more notifications', 'Please check your connection and try again.');
    } finally {
      setLoadingMore(false);
    }
  }

  async function markAllRead() {
    try {
      await api.markAllNotificationsRead();
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      Alert.alert('Unable to update notifications', error.message || 'Please try again.');
    }
  }

  async function openNotification(item) {
    try {
      if (!item.isRead) {
        await api.markNotificationRead(item.id);
        setNotifications((current) => current.map((entry) => entry.id === item.id ? { ...entry, isRead: true } : entry));
        setUnreadCount((count) => Math.max(0, count - 1));
      }
    } catch (error) {
      Alert.alert('Unable to open notification', error.message || 'Please try again.');
      return;
    }

    if (item.type === 'assessment_result') {
      if (!item.lesson?.id || !item.relatedRecordId) {
        Alert.alert('Result unavailable', 'The related assessment record is no longer available.');
        return;
      }
      navigation.navigate('Reading', {
        screen: 'AssessmentReview',
        params: { lessonId: item.lesson.id, lessonTitle: item.lesson.title, attemptId: item.relatedRecordId },
      });
    } else if (item.type === 'writing_feedback') {
      if (!item.relatedRecordId) {
        Alert.alert('Feedback unavailable', 'The related writing submission is no longer available.');
        return;
      }
      navigation.navigate('Writing', { screen: 'WritingSubmissionDetail', params: { submissionId: item.relatedRecordId } });
    } else if (item.type === 'learning_reminder' || item.type === 'learning_milestone') {
      navigation.navigate('DailyGoals');
    }
  }

  return (
    <Screen>
      <ReadingHeader
        title="Notifications"
        subtitle="Updates about your learning activities and goals."
        eyebrow="NOTIFICATION CENTER"
        onBack={() => navigation.goBack()}
      />
      <View style={styles.toolbar}>
        <Text style={styles.unreadText}>{unreadCount} unread</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh notifications"
          disabled={refreshing || loading}
          onPress={() => loadFirstPage(true)}
          style={({ pressed }) => [styles.textAction, pressed && styles.pressed]}
        >
          <Ionicons name="refresh-outline" size={16} color={colors.green} />
          <Text style={styles.actionText}>{refreshing ? 'Refreshing…' : 'Refresh'}</Text>
        </Pressable>
        {unreadCount > 0 ? (
          <Pressable accessibilityRole="button" onPress={markAllRead} style={({ pressed }) => [styles.textAction, pressed && styles.pressed]}>
            <Text style={styles.actionText}>Mark all as read</Text>
          </Pressable>
        ) : null}
      </View>

      {loading ? <ReadingState kind="loading" title="Loading notifications…" /> : null}
      {!loading && failed ? (
        <ReadingState
          kind="error"
          title="Unable to load notifications."
          message="Please check your connection and try again."
          onRetry={() => setReload((value) => value + 1)}
        />
      ) : null}
      {!loading && !failed && notifications.length === 0 ? (
        <ReadingState kind="empty" title="You’re all caught up." message="Learning updates and reminders will appear here." />
      ) : null}
      {!loading && !failed ? notifications.map((item) => {
        const display = notificationStyles[item.type] || { icon: 'notifications-outline', label: 'UPDATE', color: colors.green };
        return (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={`${item.isRead ? '' : 'Unread: '}${item.title}. ${item.message}`}
            onPress={() => openNotification(item)}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Card style={[styles.notificationCard, !item.isRead && styles.unreadCard]}>
              <View style={[styles.iconWrap, { backgroundColor: item.isRead ? colors.background : colors.greenLight }]}>
                <Ionicons name={display.icon} size={20} color={display.color} />
              </View>
              <View style={styles.copy}>
                <View style={styles.titleRow}>
                  <Text style={styles.typeLabel}>{display.label}</Text>
                  {!item.isRead ? <View accessibilityLabel="Unread" style={styles.unreadDot} /> : null}
                </View>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.message}>{item.message}</Text>
                {item.lesson?.title ? <Text style={styles.related}>{item.lesson.title}</Text> : null}
                <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={colors.muted} />
            </Card>
          </Pressable>
        );
      }) : null}
      {!loading && !failed && pagination && pagination.page < pagination.totalPages ? (
        <AssessmentButton title={loadingMore ? 'Loading…' : 'Load older notifications'} variant="secondary" onPress={loadMore} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  unreadText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  textAction: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 5 },
  actionText: { color: colors.green, fontSize: 12, fontWeight: '800' },
  notificationCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, padding: 14 },
  unreadCard: { borderColor: '#C9DFD0', backgroundColor: '#FBFDFB' },
  iconWrap: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typeLabel: { color: colors.green, fontSize: 9, letterSpacing: 0.6, fontWeight: '800' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green },
  title: { color: colors.ink, fontSize: 14, lineHeight: 20, fontWeight: '800', marginTop: 4 },
  message: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  related: { color: colors.greenDark, fontSize: 11, lineHeight: 16, fontWeight: '700', marginTop: 6 },
  date: { color: colors.muted, fontSize: 10, marginTop: 8 },
  pressed: { opacity: 0.78 },
});
