import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useCallKeepAwake } from '@/hooks/useCallKeepAwake';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, palette, radius } from '@/theme/tokens';
import { AppText } from '@/components/common/AppText';
import { LogoMark } from '@/components/common/Logo';
import { StatusPill } from '@/components/common/Chip';
import { getReminder } from '@/services/database/reminderRepository';
import {
  markDeclined,
  markRinging,
  snoozeReminder,
} from '@/features/reminders/services/reminderService';
import { useRemindersStore } from '@/store/remindersStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useUiStore } from '@/store/uiStore';
import { formatDateLong, formatTime } from '@/utils/date';
import { repeatDescription } from '@/utils/recurrence';
import { hapticMedium, hapticSuccess } from '@/utils/haptics';
import type { Reminder } from '@/types/reminder';

const CALL_BG = palette.charcoal;
const TEXT = '#F7F4EE';
const TEXT_DIM = '#A3A5AC';

export default function IncomingCallScreen() {
  useCallKeepAwake();
  const params = useLocalSearchParams<{ id?: string; at?: string }>();
  const insets = useSafeAreaInsets();
  const reminders = useRemindersStore((state) => state.reminders);
  const refresh = useRemindersStore((state) => state.refresh);
  const showToast = useUiStore((state) => state.showToast);
  const [fetched, setFetched] = useState<Reminder | null>(null);
  const [busy, setBusy] = useState<'accept' | 'decline' | 'snooze' | null>(null);
  const [now, setNow] = useState(new Date());
  const pulseOne = useRef(new Animated.Value(0)).current;
  const pulseTwo = useRef(new Animated.Value(0)).current;
  const marked = useRef(false);

  const reminder =
    reminders.find((item) => item.id === params.id) ?? fetched;

  useEffect(() => {
    if (reminder || !params.id) return;
    getReminder(params.id).then(setFetched).catch(() => undefined);
  }, [params.id, reminder]);

  const occurrence = new Date(
    Number(params.at ?? (reminder ? new Date(reminder.scheduledAt).getTime() : Date.now())),
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const one = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseOne, {
          toValue: 1,
          duration: 2100,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulseOne, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    const two = Animated.loop(
      Animated.sequence([
        Animated.delay(700),
        Animated.timing(pulseTwo, {
          toValue: 1,
          duration: 2100,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulseTwo, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    one.start();
    two.start();
    return () => {
      one.stop();
      two.stop();
    };
  }, [pulseOne, pulseTwo]);

  useEffect(() => {
    if (!reminder || !params.id || marked.current) return;
    if (!['scheduled', 'snoozed'].includes(reminder.status)) return;
    marked.current = true;
    markRinging(reminder, occurrence)
      .then(() => refresh())
      .catch(() => undefined);
  }, [occurrence, params.id, refresh, reminder]);

  useEffect(() => {
    const timer = setInterval(() => {
      hapticMedium().catch(() => undefined);
    }, 1800);
    return () => clearInterval(timer);
  }, []);

  const goHome = () => {
    router.replace('/');
  };

  const accept = () => {
    if (!reminder || busy) return;
    setBusy('accept');
    hapticSuccess().catch(() => undefined);
    router.replace({
      pathname: '/active/[id]',
      params: { id: reminder.id, at: String(occurrence.getTime()) },
    });
  };

  const decline = async () => {
    if (!reminder || busy) return;
    setBusy('decline');
    try {
      await markDeclined(reminder, occurrence, useSettingsStore.getState().settings);
      await refresh();
      showToast('Call declined.');
      goHome();
    } catch {
      setBusy(null);
      showToast('Could not decline this call.', 'error');
    }
  };

  const snooze = async () => {
    if (!reminder || busy) return;
    setBusy('snooze');
    try {
      await snoozeReminder(reminder, occurrence, reminder.snoozeMinutes);
      await refresh();
      showToast(`Snoozed for ${reminder.snoozeMinutes} minutes.`);
      goHome();
    } catch {
      setBusy(null);
      showToast('Could not snooze this call.', 'error');
    }
  };

  const ended = reminder
    ? ['completed', 'declined', 'cancelled', 'missed'].includes(reminder.status)
    : false;

  if (!reminder) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + spacing['4xl'] }]}>
        <StatusBar style="light" />
        <View style={styles.endedWrap}>
          <LogoMark size={64} color={TEXT_DIM} />
          <AppText variant="h2" color={TEXT} align="center" style={{ marginTop: spacing['2xl'] }}>
            This call has ended
          </AppText>
          <AppText variant="body" color={TEXT_DIM} align="center" style={{ marginTop: spacing.sm }}>
            The reminder is no longer ringing. Your call history is safe in Events.
          </AppText>
          <Pressable
            onPress={goHome}
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

  if (ended) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + spacing['4xl'] }]}>
        <StatusBar style="light" />
        <View style={styles.endedWrap}>
          <LogoMark size={64} color={TEXT_DIM} />
          <AppText variant="micro" color={TEXT_DIM} style={{ marginTop: spacing['2xl'] }}>
            RINGO · CALL ENDED
          </AppText>
          <AppText variant="h1" color={TEXT} align="center" style={{ marginTop: spacing.sm }}>
            {reminder.title}
          </AppText>
          <AppText variant="body" color={TEXT_DIM} align="center" style={{ marginTop: spacing.sm }}>
            This reminder is marked {reminder.status}.
          </AppText>
          <Pressable onPress={goHome} style={[styles.secondaryPill, { marginTop: spacing['2xl'] }]}>
            <Ionicons name="arrow-back" size={16} color={TEXT} />
            <AppText variant="bodyStrong" color={TEXT}>
              Back to RINGO
            </AppText>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl }]}>
      <StatusBar style="light" />

      <View pointerEvents="none" style={styles.decor}>
        <View style={[styles.decorRing, { borderColor: 'rgba(255,107,74,0.10)', width: 520, height: 520, top: -180 }]} />
        <View style={[styles.decorRing, { borderColor: 'rgba(255,107,74,0.06)', width: 700, height: 700, top: -270 }]} />
      </View>

      <View style={styles.top}>
        <View style={styles.liveRow}>
          <View style={[styles.liveDot, { backgroundColor: palette.coral }]} />
          <AppText variant="micro" color={palette.coral}>
            INCOMING REMINDER CALL
          </AppText>
        </View>
        <AppText variant="caption" color={TEXT_DIM} style={{ marginTop: 6 }}>
          {formatDateLong(occurrence)} · {formatTime(occurrence, false)}
        </AppText>
      </View>

      <View style={styles.identity}>
        <View style={styles.pulseWrap}>
          <Animated.View
            style={[
              styles.pulse,
              {
                borderColor: 'rgba(255,107,74,0.38)',
                opacity: pulseOne.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
                transform: [
                  { scale: pulseOne.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.55] }) },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.pulse,
              {
                borderColor: 'rgba(255,107,74,0.26)',
                opacity: pulseTwo.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
                transform: [
                  { scale: pulseTwo.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.85] }) },
                ],
              },
            ]}
          />
          <View style={styles.avatar}>
            <LogoMark size={88} color={palette.coral} />
          </View>
        </View>

        <AppText variant="micro" color={TEXT_DIM} style={{ marginTop: spacing['3xl'], letterSpacing: 2 }}>
          RINGO
        </AppText>
        <AppText variant="h1" color={TEXT} align="center" style={styles.title} numberOfLines={3}>
          {reminder.title}
        </AppText>
        <AppText variant="body" color={TEXT_DIM} align="center" style={styles.message} numberOfLines={3}>
          {reminder.message}
        </AppText>

        <View style={styles.metaRow}>
          {reminder.priority !== 'normal' ? (
            <StatusPill
              label={reminder.priority.toUpperCase()}
              color={reminder.priority === 'urgent' ? palette.red : palette.gold}
              background="rgba(255,255,255,0.08)"
              dot={false}
            />
          ) : null}
          <StatusPill
            label={repeatDescription(reminder.repeatType, reminder.repeatDays).toUpperCase()}
            color={TEXT_DIM}
            background="rgba(255,255,255,0.06)"
            dot={false}
          />
        </View>

        <AppText variant="caption" color={TEXT_DIM} align="center" style={{ marginTop: spacing.lg }}>
          Reminder call · {Math.max(0, Math.floor((now.getTime() - occurrence.getTime()) / 1000))}s
        </AppText>
      </View>

      <View style={styles.actions}>
        <View style={styles.callRow}>
          <View style={styles.callAction}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Decline reminder call"
              disabled={busy !== null}
              onPress={decline}
              style={({ pressed }) => [
                styles.callButton,
                {
                  backgroundColor: palette.red,
                  opacity: busy && busy !== 'decline' ? 0.5 : pressed ? 0.8 : 1,
                },
              ]}
            >
              <Ionicons name="call" size={30} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
            </Pressable>
            <AppText variant="caption" color={TEXT_DIM}>
              {busy === 'decline' ? 'Declining…' : 'Decline'}
            </AppText>
          </View>

          <View style={styles.callAction}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Accept reminder call"
              disabled={busy !== null}
              onPress={accept}
              style={({ pressed }) => [
                styles.callButton,
                {
                  backgroundColor: '#2FBF71',
                  opacity: busy && busy !== 'accept' ? 0.5 : pressed ? 0.8 : 1,
                },
              ]}
            >
              <Ionicons name="call" size={30} color="#FFFFFF" />
            </Pressable>
            <AppText variant="caption" color={TEXT_DIM}>
              Accept
            </AppText>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Snooze for ${reminder.snoozeMinutes} minutes`}
          disabled={busy !== null}
          onPress={snooze}
          style={({ pressed }) => [
            styles.snoozePill,
            { opacity: busy && busy !== 'snooze' ? 0.5 : pressed ? 0.75 : 1 },
          ]}
        >
          <Ionicons name="time-outline" size={17} color={TEXT} />
          <AppText variant="bodyStrong" color={TEXT}>
            {busy === 'snooze'
              ? 'Snoozing…'
              : `Snooze ${reminder.snoozeMinutes} min`}
          </AppText>
        </Pressable>

        <AppText variant="caption" color={TEXT_DIM} align="center" style={styles.hint}>
          Accept to hear the reminder spoken aloud. Snooze reschedules this call.
        </AppText>
      </View>
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
  top: {
    alignItems: 'center',
    marginTop: spacing.sm,
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
  identity: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  pulseWrap: {
    width: 190,
    height: 190,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 1.5,
  },
  avatar: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: 'rgba(255,107,74,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,74,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: spacing.sm,
    maxWidth: 330,
  },
  message: {
    marginTop: spacing.md,
    maxWidth: 320,
    lineHeight: 23,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  actions: {
    gap: spacing.lg,
    alignItems: 'center',
  },
  callRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: spacing['2xl'],
  },
  callAction: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  callButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 12,
  },
  snoozePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing['2xl'],
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  hint: {
    maxWidth: 300,
    lineHeight: 18,
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
