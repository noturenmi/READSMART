import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Screen } from '../components/Screen';
import { SectionTitle } from '../components/SectionTitle';
import { colors } from '../theme';

export function HomeScreen({ navigation }) {
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
