import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useCallKeepAwake } from '@/hooks/useCallKeepAwake';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette, radius, spacing } from '@/theme/tokens';
import { AppText } from '@/components/common/AppText';
import { LogoMark } from '@/components/common/Logo';
import { StatusPill } from '@/components/common/Chip';
import { getReminder } from '@/services/database/reminderRepository';
import {
  acceptReminder,
  markAnswered,
  markCompleted,
  snoozeReminder,
} from '@/features/reminders/services/reminderService';
import { useSpeechPlayer } from '@/features/voice/hooks/useSpeechPlayer';
import { useRemindersStore } from '@/store/remindersStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useUiStore } from '@/store/uiStore';
import { formatClockDuration, formatTime } from '@/utils/date';
import { repeatDescription } from '@/utils/recurrence';
import { hapticSuccess, hapticTap } from '@/utils/haptics';
import type { Reminder } from '@/types/reminder';

const CALL_BG = palette.charcoal;
const TEXT = '#F7F4EE';
const TEXT_DIM = '#A3A5AC';

export default function ActiveCallScreen() {
  const params = useLocalSearchParams<{ id?: string; at?: string }>();
  const reminders = useRemindersStore((state) => state.reminders);
  const [fetched, setFetched] = useState<Reminder | null>(null);

  const reminder = reminders.find((item) => item.id === params.id) ?? fetched;

  useEffect(() => {
    if (reminder || !params.id) return;
    getReminder(params.id).then(setFetched).catch(() => undefined);
  }, [params.id, reminder]);

  if (!reminder) {
    return <EndedScreen title="This call has ended" message="The reminder is no longer available." />;
  }

  if (['completed', 'declined', 'cancelled', 'missed'].includes(reminder.status)) {
    return (
      <EndedScreen
        title={reminder.title}
        message={`This reminder is already marked ${reminder.status}.`}
      />
    );
  }

  const occurrence = new Date(Number(params.at ?? new Date(reminder.scheduledAt).getTime()));
  return <ActiveCallView reminder={reminder} occurrence={occurrence} />;
}

function EndedScreen({ title, message }: { title: string; message: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing['4xl'] }]}>
      <StatusBar style="light" />
      <View style={styles.endedWrap}>
        <LogoMark size={64} color={TEXT_DIM} />
        <AppText variant="h2" color={TEXT} align="center" style={{ marginTop: spacing['2xl'] }}>
          {title}
        </AppText>
        <AppText variant="body" color={TEXT_DIM} align="center" style={{ marginTop: spacing.sm }}>
          {message}
        </AppText>
        <Pressable
          onPress={() => router.replace('/')}
          style={[styles.secondaryPill, { marginTop: spacing['2xl'] }]}
        >
          <Ionicons name="arrow-back" size={16} color={TEXT} />
          <AppText variant="bodyStrong" color={TEXT}>
            Back to RINGO
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

function ActiveCallView({ reminder, occurrence }: { reminder: Reminder; occurrence: Date }) {
  useCallKeepAwake();
  const insets = useSafeAreaInsets();
  const refresh = useRemindersStore((state) => state.refresh);
  const showToast = useUiStore((state) => state.showToast);
  const [busy, setBusy] = useState<'complete' | 'snooze' | 'end' | null>(null);
  const [startedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const accepted = useRef(false);

  const player = useSpeechPlayer({
    message: reminder.message,
    rate: reminder.speechRate,
    pitch: reminder.speechPitch,
    voiceId: reminder.voiceId,
    autoStart: true,
  });

  useEffect(() => {
    if (accepted.current) return;
    accepted.current = true;
    acceptReminder(reminder, occurrence)
      .then(() => refresh())
      .catch(() => undefined);
  }, [occurrence, refresh, reminder]);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  const finish = async (outcome: 'complete' | 'snooze' | 'end') => {
    if (busy) return;
    setBusy(outcome);
    player.stop();
    const settings = useSettingsStore.getState().settings;
    try {
      if (outcome === 'complete') {
        await markCompleted(reminder, occurrence, settings);
        await hapticSuccess();
        showToast('Reminder marked complete.', 'success');
      } else if (outcome === 'snooze') {
        await snoozeReminder(reminder, occurrence, reminder.snoozeMinutes);
        showToast(`Snoozed for ${reminder.snoozeMinutes} minutes.`);
      } else {
        await markAnswered(reminder, occurrence, settings);
        showToast('Call ended.');
      }
      await refresh();
      router.replace('/');
    } catch {
      setBusy(null);
      showToast('Could not update this call.', 'error');
    }
  };

  const highlight = player.highlight;
  const message = reminder.message;
  const before = highlight ? message.slice(0, highlight.start) : message;
  const during = highlight ? message.slice(highlight.start, highlight.end) : '';
  const after = highlight ? message.slice(highlight.end) : '';

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl }]}>
      <StatusBar style="light" />

      <View pointerEvents="none" style={styles.decor}>
        <View style={[styles.decorRing, { width: 520, height: 520, top: -220, borderColor: 'rgba(255,107,74,0.08)' }]} />
        <View style={[styles.decorRing, { width: 720, height: 720, top: -320, borderColor: 'rgba(255,107,74,0.05)' }]} />
      </View>

      <View style={styles.callTop}>
        <View style={styles.liveRow}>
          <View style={[styles.liveDot, { backgroundColor: '#2FBF71' }]} />
          <AppText variant="micro" color="#7FE0AC">
            {player.isPaused ? 'CALL PAUSED' : player.isSpeaking ? 'SPEAKING' : 'CALL CONNECTED'}
          </AppText>
        </View>
        <AppText variant="caption" color={TEXT_DIM} style={{ marginTop: 5 }}>
          RINGO · {formatClockDuration(elapsed)} · {formatTime(occurrence, false)}
        </AppText>
      </View>

      <View style={styles.contact}>
        <View style={styles.avatar}>
          <LogoMark size={64} color={palette.coral} />
        </View>
        <AppText variant="h2" color={TEXT} align="center" style={{ marginTop: spacing.lg }} numberOfLines={2}>
          {reminder.title}
        </AppText>
        <View style={styles.metaRow}>
          <StatusPill
            label={repeatDescription(reminder.repeatType, reminder.repeatDays).toUpperCase()}
            color={TEXT_DIM}
            background="rgba(255,255,255,0.06)"
            dot={false}
          />
          {reminder.priority !== 'normal' ? (
            <StatusPill
              label={reminder.priority.toUpperCase()}
              color={reminder.priority === 'urgent' ? palette.red : palette.gold}
              background="rgba(255,255,255,0.08)"
              dot={false}
            />
          ) : null}
        </View>
      </View>

      <View style={styles.transcriptCard}>
        <View style={styles.transcriptHeader}>
          <Ionicons name="volume-high" size={14} color={palette.coral} />
          <AppText variant="micro" color={palette.coral}>
            {player.isSpeaking ? 'RINGO IS READING' : 'REMINDER'}
          </AppText>
          <View style={{ flex: 1 }} />
          {player.hasWordTiming ? (
            <AppText variant="caption" color={TEXT_DIM}>
              word sync
            </AppText>
          ) : (
            <AppText variant="caption" color={TEXT_DIM}>
              sentence sync
            </AppText>
          )}
        </View>

        <View style={styles.transcriptWrap}>
          <Text style={styles.transcript}>
            <Text style={{ color: player.highlight ? TEXT_DIM : TEXT }}>{before}</Text>
            {during ? (
              <Text
                style={{
                  color: '#FFFFFF',
                  backgroundColor: 'rgba(255,107,74,0.34)',
                }}
              >
                {during}
              </Text>
            ) : null}
            <Text style={{ color: player.isSpeaking ? TEXT_DIM : TEXT }}>{after}</Text>
          </Text>
        </View>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: palette.coral,
                width: `${Math.max(2, Math.min(100, player.progress * 100))}%`,
              },
            ]}
          />
        </View>

        <View style={styles.transcriptFooter}>
          <AppText variant="caption" color={TEXT_DIM} numberOfLines={1} style={{ flex: 1 }}>
            {player.error
              ? player.error
              : player.isPaused
                ? 'Paused — resume to keep listening.'
                : player.isSpeaking
                  ? `Sentence ${Math.max(1, player.currentSentence + 1)} of ${Math.max(1, player.sentences.length)}`
                  : 'Reading complete.'}
          </AppText>
          <SpeakingBars active={player.isSpeaking} />
        </View>
      </View>

      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Repeat reminder from the beginning"
          onPress={() => {
            hapticTap();
            player.repeat();
          }}
          style={({ pressed }) => [styles.smallControl, { opacity: pressed ? 0.65 : 1 }]}
        >
          <Ionicons name="refresh" size={20} color={TEXT} />
          <AppText variant="caption" color={TEXT_DIM}>
            Repeat
          </AppText>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={player.isPaused ? 'Resume reading' : 'Pause reading'}
          onPress={() => {
            hapticTap();
            if (!player.isSpeaking && !player.isPaused) {
              player.repeat();
            } else {
              player.togglePause();
            }
          }}
          style={({ pressed }) => [
            styles.playButton,
            {
              backgroundColor: palette.coral,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            },
          ]}
        >
          <Ionicons
            name={player.isPaused || !player.isSpeaking ? 'play' : 'pause'}
            size={32}
            color="#170B07"
          />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Snooze reminder"
          onPress={() => finish('snooze')}
          disabled={busy !== null}
          style={({ pressed }) => [
            styles.smallControl,
            { opacity: busy && busy !== 'snooze' ? 0.45 : pressed ? 0.65 : 1 },
          ]}
        >
          <Ionicons name="time-outline" size={20} color={TEXT} />
          <AppText variant="caption" color={TEXT_DIM}>
            Snooze
          </AppText>
        </Pressable>
      </View>

      <View style={styles.bottomActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="End call"
          disabled={busy !== null}
          onPress={() => finish('end')}
          style={({ pressed }) => [
            styles.endButton,
            {
              backgroundColor: 'rgba(240,82,82,0.16)',
              borderColor: 'rgba(240,82,82,0.36)',
              opacity: busy && busy !== 'end' ? 0.45 : pressed ? 0.7 : 1,
            },
          ]}
        >
          <Ionicons
            name="call"
            size={18}
            color={palette.red}
            style={{ transform: [{ rotate: '135deg' }] }}
          />
          <AppText variant="bodyStrong" color={palette.red}>
            {busy === 'end' ? 'Ending…' : 'End call'}
          </AppText>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mark reminder complete"
          disabled={busy !== null}
          onPress={() => finish('complete')}
          style={({ pressed }) => [
            styles.doneButton,
            {
              backgroundColor: '#2FBF71',
              opacity: busy && busy !== 'complete' ? 0.45 : pressed ? 0.82 : 1,
            },
          ]}
        >
          <Ionicons name="checkmark" size={19} color="#07150D" />
          <AppText variant="bodyStrong" color="#07150D">
            {busy === 'complete' ? 'Saving…' : 'Done'}
          </AppText>
        </Pressable>
      </View>

      <AppText variant="caption" color={TEXT_DIM} align="center" style={{ marginTop: spacing.md, lineHeight: 17 }}>
        Ending the call records it as answered. Done finishes this occurrence.
      </AppText>
    </View>
  );
}

function SpeakingBars({ active }: { active: boolean }) {
  const values = useMemo(
    () => [0, 1, 2, 3, 4].map(() => new Animated.Value(0.22)),
    [],
  );

  useEffect(() => {
    const animations = values.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 90),
          Animated.timing(value, {
            toValue: 1,
            duration: 280 + index * 40,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0.22,
            duration: 300 + index * 30,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    if (active) {
      animations.forEach((animation) => animation.start());
    } else {
      values.forEach((value) => value.setValue(0.22));
    }
    return () => animations.forEach((animation) => animation.stop());
  }, [active, values]);

  return (
    <View style={styles.bars}>
      {values.map((value, index) => (
        <Animated.View
          key={`bar-${index}`}
          style={[
            styles.bar,
            {
              backgroundColor: active ? palette.coral : TEXT_DIM,
              transform: [{ scaleY: value }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: CALL_BG,
    paddingHorizontal: spacing['2xl'],
  },
  decor: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    overflow: 'hidden',
  },
  decorRing: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
  },
  callTop: {
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  contact: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,107,74,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,74,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  transcriptCard: {
    flex: 1,
    minHeight: 190,
    marginTop: spacing.xl,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    padding: spacing.lg,
    justifyContent: 'space-between',
  },
  transcriptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  transcriptWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  transcript: {
    fontSize: 21,
    lineHeight: 31,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
  },
  transcriptFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 20,
  },
  bar: {
    width: 3,
    height: 18,
    borderRadius: 2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
  smallControl: {
    alignItems: 'center',
    gap: 5,
    width: 68,
  },
  playButton: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 14,
  },
  bottomActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  endButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  doneButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  endedWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  secondaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});
