import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { Card } from './Screen';
import { colors } from '../theme';
import { createSpeechController } from '../utils/speechController';

const supportsPause = Platform.OS !== 'android';

export function TextToSpeechControls({ text, active = true }) {
  const [playbackState, setPlaybackState] = useState('idle');
  const [error, setError] = useState('');
  const controllerRef = useRef(null);
  const textRef = useRef(text);

  if (!controllerRef.current) {
    controllerRef.current = createSpeechController(Speech, {
      supportsPause,
      onState: setPlaybackState,
      onError: setError,
    });
  }

  useEffect(() => {
    if (!active) void controllerRef.current.stop({ silent: true });
  }, [active]);

  useEffect(() => {
    if (textRef.current !== text) {
      textRef.current = text;
      setError('');
      void controllerRef.current.stop({ silent: true });
    }
  }, [text]);

  useEffect(() => () => {
    void controllerRef.current?.stop({ silent: true });
  }, []);

  async function start() {
    setError('');
    await controllerRef.current.play(text);
  }

  const isPlaying = playbackState === 'speaking' || playbackState === 'starting';

  return (
    <Card style={styles.card}>
      <View style={styles.headingRow}>
        <Ionicons name="volume-high-outline" size={20} color={colors.greenDark} />
        <Text style={styles.heading}>Listen to Lesson</Text>
      </View>
      {playbackState === 'idle' ? (
        <ControlButton
          label="Listen to lesson"
          title="Read Aloud"
          icon="play"
          onPress={start}
          disabled={!active || !text?.trim()}
        />
      ) : (
        <View style={styles.actions}>
          {playbackState === 'starting' ? (
            <View style={styles.status}>
              <ActivityIndicator color={colors.green} />
              <Text style={styles.statusText}>Starting lesson audio…</Text>
            </View>
          ) : supportsPause && playbackState === 'speaking' ? (
            <ControlButton label="Pause lesson audio" title="Pause" icon="pause" onPress={() => controllerRef.current.pause()} />
          ) : supportsPause && playbackState === 'paused' ? (
            <ControlButton label="Resume lesson audio" title="Resume" icon="play" onPress={() => controllerRef.current.resume()} />
          ) : (
            <Text style={styles.statusText}>Lesson audio is playing.</Text>
          )}
          <ControlButton label="Stop lesson audio" title="Stop" icon="stop" variant="secondary" onPress={() => controllerRef.current.stop()} />
        </View>
      )}
      {playbackState === 'speaking' && !supportsPause ? (
        <Text style={styles.limitation}>Pause and resume are not supported by Expo Speech on Android. You can stop playback at any time.</Text>
      ) : null}
      {!text?.trim() ? <Text style={styles.message}>There is no lesson text available to read.</Text> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </Card>
  );
}

function ControlButton({ label, title, icon, onPress, disabled = false, variant = 'primary' }) {
  const secondary = variant === 'secondary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, secondary && styles.secondaryButton, disabled && styles.disabledButton, pressed && !disabled && styles.pressed]}
    >
      <Ionicons name={icon} size={18} color={secondary ? colors.greenDark : '#FFFFFF'} />
      <Text style={[styles.buttonText, secondary && styles.secondaryText, disabled && styles.disabledText]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: 11 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heading: { color: colors.greenDark, fontSize: 15, fontWeight: '800' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  button: { minHeight: 48, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: colors.green, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  secondaryButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  disabledButton: { backgroundColor: '#E3E8E4', borderColor: '#E3E8E4' },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  secondaryText: { color: colors.greenDark },
  disabledText: { color: colors.muted },
  pressed: { opacity: 0.8 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 10 },
  statusText: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  message: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  limitation: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  error: { color: '#9E3C36', fontSize: 12, lineHeight: 18 },
});
