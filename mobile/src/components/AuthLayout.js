import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

export function AuthLayout({ eyebrow, title, description, children }) {
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brandMark}><Text style={styles.brandLetter}>R</Text></View>
          <Text style={styles.brand}>READSMART</Text>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
          {children}
          <Text style={styles.note}>A learning companion for your classroom journey.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  brandMark: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  brandLetter: { color: '#FFFFFF', fontWeight: '800', fontSize: 23 },
  brand: { color: colors.green, fontWeight: '800', fontSize: 11, letterSpacing: 1.2, marginBottom: 28 },
  eyebrow: { color: colors.green, fontWeight: '800', fontSize: 10, letterSpacing: 1 },
  title: { color: colors.ink, fontSize: 27, fontWeight: '800', marginTop: 6 },
  description: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 7, marginBottom: 23 },
  note: { color: colors.muted, textAlign: 'center', fontSize: 11, marginTop: 25 },
});
