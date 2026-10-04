import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Screen';
import { colors } from '../theme';

export function AdminHeader({ title, subtitle, onBack }) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} style={styles.back}>
          <Ionicons name="arrow-back" size={19} color={colors.ink} />
        </Pressable>
      ) : null}
      <View style={styles.headerText}>
        <Text style={styles.eyebrow}>READSMART ADMIN</Text>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

export function AdminButton({ title, onPress, secondary = false, danger = false, disabled = false, icon }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        danger && styles.danger,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {icon ? <Ionicons name={icon} size={17} color={secondary ? colors.greenDark : '#FFFFFF'} /> : null}
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{title}</Text>
    </Pressable>
  );
}

export function AdminField({ label, value, onChangeText, multiline = false, keyboardType = 'default', placeholder, editable = true }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value == null ? '' : String(value)}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder || label}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        editable={editable}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.input, multiline && styles.multiline, !editable && styles.readOnly]}
      />
    </View>
  );
}

export function AdminCard({ children, style }) {
  return <Card style={[styles.card, style]}>{children}</Card>;
}

export function AdminSectionTitle({ children, hint }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function AdminInlineActions({ children }) {
  return <View style={styles.actions}>{children}</View>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  back: { width: 38, height: 38, marginTop: 2, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  headerText: { flex: 1 },
  eyebrow: { color: colors.green, fontSize: 10, fontWeight: '800', letterSpacing: 0.9 },
  title: { color: colors.ink, fontSize: 23, lineHeight: 29, fontWeight: '800', marginTop: 5 },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  button: { minHeight: 45, flexGrow: 1, flexBasis: '45%', paddingHorizontal: 13, paddingVertical: 10, borderRadius: 13, backgroundColor: colors.green, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  secondary: { backgroundColor: colors.greenLight, borderWidth: 1, borderColor: '#D8E8DC' },
  danger: { backgroundColor: '#A2483F' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.78 },
  buttonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  secondaryText: { color: colors.greenDark },
  field: { gap: 6 },
  label: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  input: { minHeight: 45, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 12, color: colors.ink, fontSize: 13 },
  multiline: { minHeight: 98, paddingTop: 11, lineHeight: 19 },
  readOnly: { opacity: 0.7 },
  card: { gap: 11, padding: 14 },
  section: { gap: 3, marginTop: 2 },
  sectionTitle: { color: colors.greenDark, fontSize: 16, fontWeight: '800' },
  hint: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
