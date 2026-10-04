import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Screen } from '../components/Screen';
import { colors } from '../theme';
import { useAuth } from '../auth/AuthContext';
import { PrimaryButton } from '../components/AuthForm';

export function ProfileScreen() {
  const { user, signOut } = useAuth();
  return (
    <Screen>
      <View>
        <Text style={styles.eyebrow}>YOUR SPACE</Text>
        <Text style={styles.title}>Profile</Text>
      </View>
      <Card style={styles.profile}>
        <View style={styles.avatar}><Ionicons name="person-outline" size={28} color={colors.green} /></View>
        <Text style={styles.name}>{user?.name || 'Student'}</Text>
        <Text style={styles.subtitle}>{user?.email}</Text>
      </Card>
      <Card style={styles.row}><Ionicons name="school-outline" size={20} color={colors.green} /><Text style={styles.rowText}>Senior High School · HUMSS</Text></Card>
      <Card style={styles.info}>
        <Ionicons name="information-circle-outline" size={20} color={colors.blue} />
        <Text style={styles.infoText}>READSMART is a supplementary learning tool. Your teacher continues to guide classroom learning and formal assessment.</Text>
      </Card>
      <PrimaryButton title="Sign out" onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.green, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.ink, fontSize: 25, fontWeight: '800', marginTop: 6 },
  profile: { alignItems: 'center', paddingVertical: 24 },
  avatar: { width: 68, height: 68, borderRadius: 23, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.ink, fontSize: 19, fontWeight: '800', marginTop: 11 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 5, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  rowText: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  info: { flexDirection: 'row', gap: 11, alignItems: 'flex-start', backgroundColor: colors.blueLight, borderColor: '#DCE9ED' },
  infoText: { flex: 1, color: '#4F6873', fontSize: 12, lineHeight: 18 },
});
