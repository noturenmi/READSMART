import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Screen';
import { colors } from '../theme';

const subjectIcons = {
  MIL: ['newspaper-outline', colors.blueLight],
  UCSP: ['people-outline', colors.greenLight],
  CPAR: ['color-palette-outline', colors.goldLight],
  ELS: ['leaf-outline', '#E9F0E2'],
};

export function ReadingHeader({ title, subtitle, onBack, eyebrow = 'READING LIBRARY' }) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} style={styles.back} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={colors.ink} />
        </Pressable>
      ) : null}
      <View style={styles.headerCopy}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

export function SubjectCard({ subject, onPress }) {
  const [iconName, tone] = subjectIcons[subject.code] || ['book-outline', colors.greenLight];
  const lessonSummary = subject.availableLessonCount > 0
    ? `${subject.availableLessonCount} lesson${subject.availableLessonCount === 1 ? '' : 's'} available`
    : subject.plannedLessonCount > 0
      ? `${subject.plannedLessonCount} lessons planned · content being prepared`
      : 'No lessons available yet';

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <Card style={styles.subjectCard}>
        <View style={[styles.subjectIcon, { backgroundColor: tone }]}>
          <Ionicons name={iconName} size={21} color={colors.greenDark} />
        </View>
        <View style={styles.cardCopy}>
          <Text style={styles.code}>{subject.code}</Text>
          <Text style={styles.subjectName}>{subject.name}</Text>
          {subject.description ? <Text style={styles.description}>{subject.description}</Text> : null}
          <Text style={styles.meta}>{lessonSummary}</Text>
        </View>
        <Ionicons name="chevron-forward" size={19} color={colors.muted} />
      </Card>
    </Pressable>
  );
}

export function LessonCard({ lesson, onPress }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <Card style={styles.lessonCard}>
        <View style={styles.lessonNumber}><Text style={styles.lessonNumberText}>{lesson.lessonNumber}</Text></View>
        <View style={styles.cardCopy}>
          <Text style={styles.lessonLabel}>LESSON {lesson.lessonNumber}</Text>
          <Text style={styles.lessonTitle}>{lesson.title}</Text>
          {lesson.overview ? <Text style={styles.description}>{lesson.overview}</Text> : null}
        </View>
        <Ionicons name="chevron-forward" size={19} color={colors.muted} />
      </Card>
    </Pressable>
  );
}

export function ReadingState({ kind, title, message, onRetry }) {
  const loading = kind === 'loading';
  return (
    <Card style={styles.state}>
      {loading
        ? <ActivityIndicator color={colors.green} size="large" />
        : <Ionicons name={kind === 'error' ? 'cloud-offline-outline' : 'library-outline'} size={27} color={colors.green} />}
      <Text style={styles.stateTitle}>{title}</Text>
      {message ? <Text style={styles.stateMessage}>{message}</Text> : null}
      {onRetry ? (
        <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

export function ContentSection({ title, children, takeaway = false, hasContent = true }) {
  if (!hasContent || !children || (Array.isArray(children) && children.length === 0)) return null;
  return (
    <View style={[styles.contentSection, takeaway && styles.takeaway]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function ReadingParagraph({ children }) {
  if (!children) return null;
  return <Text style={styles.paragraph}>{children}</Text>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  back: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginTop: 2 },
  headerCopy: { flex: 1 },
  eyebrow: { color: colors.green, fontSize: 10, fontWeight: '800', letterSpacing: 0.9 },
  title: { color: colors.ink, fontSize: 23, fontWeight: '800', lineHeight: 29, marginTop: 5 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 5 },
  subjectCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  subjectIcon: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1 },
  code: { color: colors.green, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  subjectName: { color: colors.ink, fontSize: 13, lineHeight: 19, fontWeight: '700', marginTop: 2 },
  description: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  meta: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 5 },
  lessonCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  lessonNumber: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' },
  lessonNumberText: { color: colors.greenDark, fontSize: 15, fontWeight: '800' },
  lessonLabel: { color: colors.green, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  lessonTitle: { color: colors.ink, fontSize: 13, lineHeight: 19, fontWeight: '700', marginTop: 3 },
  pressed: { opacity: 0.78 },
  state: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20 },
  stateTitle: { color: colors.ink, textAlign: 'center', fontSize: 15, fontWeight: '700', marginTop: 12 },
  stateMessage: { color: colors.muted, textAlign: 'center', fontSize: 13, lineHeight: 19, marginTop: 5 },
  retry: { backgroundColor: colors.green, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 17, marginTop: 14 },
  retryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  contentSection: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10 },
  sectionTitle: { color: colors.greenDark, fontSize: 16, fontWeight: '800' },
  paragraph: { color: colors.ink, fontSize: 15, lineHeight: 25 },
  takeaway: { backgroundColor: colors.greenLight, borderColor: '#D8E8DC' },
});
