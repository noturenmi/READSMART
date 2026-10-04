import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export function AssessmentButton({ title, onPress, disabled = false, variant = 'primary' }) {
  const secondary = variant === 'secondary';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondaryButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={[styles.buttonText, secondary && styles.secondaryText, disabled && styles.disabledText]}>{title}</Text>
    </Pressable>
  );
}

export function AssessmentChoice({ label, selected, onPress, index }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.choice, selected && styles.selectedChoice, pressed && styles.pressed]}
    >
      <View style={[styles.choiceMarker, selected && styles.selectedMarker]}>
        {selected ? <View style={styles.choiceDot} /> : null}
      </View>
      <Text style={styles.choiceLetter}>{String.fromCharCode(65 + index)}.</Text>
      <Text style={styles.choiceText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: colors.green,
  },
  secondaryButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  disabledButton: { backgroundColor: '#E3E8E4', borderColor: '#E3E8E4' },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  secondaryText: { color: colors.greenDark },
  disabledText: { color: colors.muted },
  pressed: { opacity: 0.8 },
  choice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    minHeight: 52,
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selectedChoice: { borderColor: colors.green, backgroundColor: colors.greenLight },
  choiceMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  selectedMarker: { borderColor: colors.green },
  choiceDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.green },
  choiceLetter: { color: colors.greenDark, fontSize: 14, lineHeight: 21, fontWeight: '700' },
  choiceText: { flex: 1, color: colors.ink, fontSize: 14, lineHeight: 21 },
});
