import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme';

export function AuthField({ label, ...inputProps }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        style={styles.input}
        placeholderTextColor={colors.muted}
        autoCorrect={false}
        accessibilityLabel={label}
      />
    </View>
  );
}

export function PrimaryButton({ title, loading, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: loading }}
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && !loading && styles.pressed, loading && styles.disabled]}
    >
      {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>{title}</Text>}
    </Pressable>
  );
}

export function ErrorMessage({ message }) {
  if (!message) return null;
  return <Text accessibilityRole="alert" style={styles.error}>{message}</Text>;
}

export function AuthLink({ prompt, label, onPress }) {
  return (
    <View style={styles.linkRow}>
      <Text style={styles.linkPrompt}>{prompt}</Text>
      <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8}>
        <Text style={styles.link}>{label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 15 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '700', marginBottom: 7 },
  input: { height: 50, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 14, color: colors.ink, fontSize: 15 },
  button: { minHeight: 50, borderRadius: 14, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', marginTop: 3 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  pressed: { backgroundColor: colors.greenDark },
  disabled: { opacity: 0.7 },
  error: { color: '#9E3C36', backgroundColor: '#FCECEA', borderRadius: 12, padding: 12, fontSize: 13, lineHeight: 18, marginBottom: 15 },
  linkRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 19 },
  linkPrompt: { color: colors.muted, fontSize: 13 },
  link: { color: colors.green, fontSize: 13, fontWeight: '800' },
});
