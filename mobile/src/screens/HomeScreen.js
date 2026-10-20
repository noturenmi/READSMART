import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Card, Screen } from '../components/Screen';
import { SectionTitle } from '../components/SectionTitle';
import { ReadingState } from '../components/ReadingComponents';
import { api } from '../services/api';
import { colors } from '../theme';

export function HomeScreen({ navigation }) {
  const [recommendationData, setRecommendationData] = useState(null);
  const [recommendationsLoading, setRecommendationsLoading] = useState(true);
  const [recommendationsError, setRecommendationsError] = useState(false);
  const [recommendationsReload, setRecommendationsReload] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setRecommendationsLoading(true);
    setRecommendationsError(false);
    api.getRecommendedLessons()
      .then((result) => { if (active) setRecommendationData(result); })
      .catch(() => { if (active) setRecommendationsError(true); })
      .finally(() => { if (active) setRecommendationsLoading(false); });
    return () => { active = false; };
  }, [recommendationsReload]));

  const openRecommendedLesson = (lessonId) => {
    navigation.navigate('Reading', { screen: 'Lesson', params: { lessonId } });
  };
  const recommendations = recommendationData?.recommendations || [];

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>READSMART · HUMSS</Text>
          <Text style={styles.greeting}>Good day, learner</Text>
          <Text style={styles.subheading}>A little progress every day adds up.</Text>
        </View>
        <View style={styles.avatar}><Ionicons name="school-outline" size={24} color={colors.green} /></View>
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel="Browse reading materials" onPress={() => navigation.navigate('Reading')}>
      <Card style={styles.hero}>
        <View style={styles.heroIcon}><Ionicons name="book-outline" size={22} color={colors.greenDark} /></View>
        <Text style={styles.heroTitle}>Your next reading journey</Text>
        <Text style={styles.heroText}>Explore ideas, build understanding, and practice putting your thoughts into words.</Text>
        <Text style={styles.heroLink}>Browse learning materials  ›</Text>
      </Card>
      </Pressable>

      <SectionTitle title="Recommended Lessons to Review" />
      {recommendationsLoading ? (
        <ReadingState kind="loading" title="Checking your recent assessment results…" />
      ) : null}
      {!recommendationsLoading && recommendationsError ? (
        <ReadingState
          kind="error"
          title="Unable to load lesson recommendations."
          message="Your assessments are still available. Please try again."
          onRetry={() => setRecommendationsReload((value) => value + 1)}
        />
      ) : null}
      {!recommendationsLoading && !recommendationsError && recommendations.length ? recommendations.map((item) => (
        <Card key={item.lessonId} style={styles.recommendationCard}>
          <View style={styles.recommendationHeading}>
            <View style={styles.recommendationIcon}>
              <Ionicons name="refresh-circle-outline" size={20} color={colors.greenDark} />
            </View>
            <View style={styles.recommendationCopy}>
              <Text style={styles.recommendationSubject}>{item.subjectCode} · {item.subjectName}</Text>
              <Text style={styles.recommendationTitle}>Lesson {item.lessonNumber}: {item.lessonTitle}</Text>
            </View>
          </View>
          <Text style={styles.recommendationReason}>{item.reason}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={'Open ' + item.lessonTitle}
            onPress={() => openRecommendedLesson(item.lessonId)}
            style={({ pressed }) => [styles.recommendationButton, pressed && styles.pressed]}
          >
            <Text style={styles.recommendationButtonText}>Review lesson</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </Pressable>
        </Card>
      )) : null}
      {!recommendationsLoading && !recommendationsError && !recommendations.length ? (
        <Card style={styles.recommendationEmpty}>
          <Ionicons name="checkmark-circle-outline" size={26} color={colors.green} />
          <Text style={styles.recommendationEmptyTitle}>
            {recommendationData?.emptyReason === 'no_assessment_history'
              ? 'Your review suggestions will appear here.'
              : recommendationData?.emptyReason === 'assessment_data_incomplete'
                ? 'We need more assessment detail to suggest a lesson.'
              : 'You’re caught up for now.'}
          </Text>
          <Text style={styles.recommendationEmptyText}>
            {recommendationData?.emptyReason === 'no_assessment_history'
              ? 'Complete a reading assessment to get lesson recommendations based on your answers.'
              : recommendationData?.emptyReason === 'assessment_data_incomplete'
                ? 'Some assessment records are incomplete, so no lesson recommendation could be calculated safely.'
                : 'No lessons currently need review based on your latest assessment results.'}
          </Text>
        </Card>
      ) : null}

      <SectionTitle title="Your learning at a glance" />
      <View style={styles.stats}>
        <Stat icon="checkmark-circle-outline" value="0" label="Lessons read" tint={colors.greenLight} />
        <Stat icon="flash-outline" value="0 XP" label="Learning points" tint={colors.goldLight} />
      </View>

      <SectionTitle title="Pick up a skill" />
      <Card style={styles.tip}>
        <View style={styles.tipIcon}><Ionicons name="sparkles-outline" size={19} color={colors.blue} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.tipTitle}>Read with a question in mind</Text>
          <Text style={styles.tipText}>As you read, notice the main idea and what details support it.</Text>
        </View>
      </Card>
      <Text style={styles.note}>READSMART supports your classroom learning and does not replace your teacher.</Text>
    </Screen>
  );
}

function Stat({ icon, value, label, tint }) {
  return (
    <Card style={styles.stat}>
      <View style={[styles.statIcon, { backgroundColor: tint }]}><Ionicons name={icon} size={18} color={colors.green} /></View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  eyebrow: { color: colors.green, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  greeting: { color: colors.ink, fontSize: 25, fontWeight: '800', marginTop: 5 },
  subheading: { color: colors.muted, fontSize: 13, marginTop: 5 },
  avatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' },
  hero: { backgroundColor: colors.greenLight, borderColor: '#D8E8DC', padding: 19 },
  heroIcon: { width: 42, height: 42, backgroundColor: '#D5E8D9', borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  heroTitle: { color: colors.greenDark, fontSize: 19, fontWeight: '800' },
  heroText: { color: '#496456', fontSize: 14, lineHeight: 21, marginTop: 7 },
  heroLink: { color: colors.green, fontSize: 13, fontWeight: '800', marginTop: 15 },
  recommendationCard: { gap: 12 },
  recommendationHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  recommendationIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' },
  recommendationCopy: { flex: 1, minWidth: 0 },
  recommendationSubject: { color: colors.green, fontSize: 10, lineHeight: 15, fontWeight: '800', letterSpacing: 0.4 },
  recommendationTitle: { color: colors.ink, fontSize: 14, lineHeight: 20, fontWeight: '700', marginTop: 3 },
  recommendationReason: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  recommendationButton: { minHeight: 42, borderRadius: 12, paddingHorizontal: 14, backgroundColor: colors.green, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  recommendationButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  recommendationEmpty: { alignItems: 'center', gap: 8, paddingVertical: 18 },
  recommendationEmptyTitle: { color: colors.greenDark, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  recommendationEmptyText: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  pressed: { opacity: 0.78 },
  stats: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, padding: 14 },
  statIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 11 },
  statValue: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  statLabel: { color: colors.muted, fontSize: 12, marginTop: 3 },
  tip: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  tipIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.blueLight, alignItems: 'center', justifyContent: 'center' },
  tipTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  tipText: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  note: { color: colors.muted, textAlign: 'center', fontSize: 11, lineHeight: 17, paddingHorizontal: 14 },
});
