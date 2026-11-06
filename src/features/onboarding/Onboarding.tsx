import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from '@/components/common/AppText';
import { LogoMark } from '@/components/common/Logo';
import { PrimaryButton, SecondaryButton } from '@/components/common/Buttons';
import { useSettingsStore } from '@/store/settingsStore';
import { useUiStore } from '@/store/uiStore';
import {
  notificationPermissionGranted,
  readCapabilities,
  requestNotificationPermission,
} from '@/services/permissions';
import { hapticSuccess } from '@/utils/haptics';
import type { ScheduleCapabilities } from '@/types/reminder';

interface Step {
  eyebrow: string;
  title: string;
  body: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}

const STEPS: Step[] = [
  {
    eyebrow: 'WELCOME',
    title: 'Reminders that call you.',
    body: 'RINGO turns the things you must not forget into friendly reminder calls — with a voice that reads them out loud.',
    icon: 'call-outline',
  },
  {
    eyebrow: 'HOW IT WORKS',
    title: 'A call, not another ping.',
    body: 'When it is time, RINGO calls. Accept to hear your reminder spoken aloud, snooze it, or decline it. Every call is also saved to your timeline.',
    icon: 'notifications-outline',
  },
  {
    eyebrow: 'ONE LAST THING',
    title: 'Let RINGO reach you.',
    body: 'Allow notifications so calls can arrive while the app is closed. On Android, exact alarm access keeps the timing precise.',
    icon: 'shield-checkmark-outline',
  },
];

export function Onboarding({ visible }: { visible: boolean }) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [capabilities, setCapabilities] = useState<ScheduleCapabilities | null>(null);
  const [busy, setBusy] = useState(false);
  const updateMany = useSettingsStore((state) => state.updateMany);
  const showToast = useUiStore((state) => state.showToast);

  const current = STEPS[step];

  const refreshCapabilities = async (): Promise<ScheduleCapabilities> => {
    const snapshot = await readCapabilities();
    setCapabilities(snapshot);
    return snapshot;
  };

  const finish = async () => {
    if (busy) return;
    setBusy(true);
    try {
      let granted = await notificationPermissionGranted();
      if (!granted) {
        granted = await requestNotificationPermission();
      }
      await updateMany({ onboardingComplete: true, name: name.trim() });
      const snapshot = await readCapabilities();
      await hapticSuccess();
      if (!granted) {
        showToast('Notifications are off. RINGO cannot call you until you allow them in Settings.', 'error');
      } else if (snapshot.missingConfiguration.length > 0) {
        showToast('RINGO is ready. Some device settings may delay calls — check Reliability in Settings.');
      } else {
        showToast('RINGO is ready to call you.', 'success');
      }
    } catch {
      await updateMany({ onboardingComplete: true, name: name.trim() });
    } finally {
      setBusy(false);
    }
  };

  const next = async () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      if (step + 1 === STEPS.length - 1) {
        await refreshCapabilities();
      }
      return;
    }
    await finish();
  };

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={() => undefined}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View pointerEvents="none" style={styles.decor}>
          <View style={[styles.ring, styles.ringOne, { borderColor: `${colors.accent}20` }]} />
          <View style={[styles.ring, styles.ringTwo, { borderColor: `${colors.accent}14` }]} />
          <View style={[styles.glow, { backgroundColor: `${colors.accent}12` }]} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{
              paddingTop: insets.top + spacing.lg,
              paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.lg,
              paddingHorizontal: spacing['2xl'],
              flexGrow: 1,
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.topRow}>
              <View style={styles.dots}>
                {STEPS.map((_, index) => (
                  <View
                    key={`dot-${index}`}
                    style={[
                      styles.dot,
                      {
                        backgroundColor: index <= step ? colors.accent : colors.surfaceMuted,
                        width: index === step ? 22 : 7,
                      },
                    ]}
                  />
                ))}
              </View>
              {step < STEPS.length - 1 ? (
                <Pressable onPress={finish} hitSlop={10} disabled={busy}>
                  <AppText variant="caption" color={colors.textMuted}>
                    Skip
                  </AppText>
                </Pressable>
              ) : (
                <View style={{ width: 28 }} />
              )}
            </View>

            <View style={styles.hero}>
              <View
                style={[
                  styles.logoWrap,
                  {
                    backgroundColor: colors.accentSurface,
                    borderColor: `${colors.accent}33`,
                  },
                ]}
              >
                <LogoMark size={74} color={colors.accent} />
              </View>
              <AppText variant="micro" color={colors.accent} style={{ marginTop: spacing['2xl'] }}>
                {current.eyebrow}
              </AppText>
              <AppText variant="h1" align="center" style={{ marginTop: spacing.sm }}>
                {current.title}
              </AppText>
              <AppText
                variant="body"
                align="center"
                color={colors.textSecondary}
                style={styles.body}
              >
                {current.body}
              </AppText>
            </View>

            {step === 0 ? (
              <View style={{ marginTop: spacing['3xl'] }}>
                <AppText variant="caption" color={colors.textSecondary} weight="600" style={styles.nameLabel}>
                  WHAT SHOULD RINGO CALL YOU?
                </AppText>
                <View
                  style={[
                    styles.nameInputWrap,
                    { backgroundColor: colors.surface, borderColor: colors.borderSoft },
                  ]}
                >
                  <Ionicons name="person-outline" size={17} color={colors.textMuted} />
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Your name (optional)"
                    placeholderTextColor={colors.textMuted}
                    style={[styles.nameInput, { color: colors.text }]}
                    selectionColor={colors.accent}
                    returnKeyType="done"
                    maxLength={40}
                  />
                </View>
              </View>
            ) : null}

            {step === 1 ? (
              <View style={styles.featureList}>
                {[
                  { icon: 'call' as const, title: 'Accept to listen', text: 'The reminder is read aloud, word by word.' },
                  { icon: 'time' as const, title: 'Snooze or decline', text: 'Reschedule the call or skip this occurrence.' },
                  { icon: 'calendar' as const, title: 'Every call is history', text: 'Answered, missed and completed calls stay in your timeline.' },
                ].map((feature) => (
                  <View
                    key={feature.title}
                    style={[
                      styles.featureRow,
                      { backgroundColor: colors.surface, borderColor: colors.borderSoft },
                    ]}
                  >
                    <View style={[styles.featureIcon, { backgroundColor: colors.accentSurface }]}>
                      <Ionicons name={feature.icon} size={18} color={colors.accent} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <AppText variant="bodyStrong">{feature.title}</AppText>
                      <AppText variant="caption" color={colors.textSecondary}>
                        {feature.text}
                      </AppText>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {step === 2 ? (
              <View style={{ marginTop: spacing.xl }}>
                {[
                  {
                    label: 'Notifications',
                    ok: capabilities?.notificationsEnabled ?? false,
                    detail: capabilities?.notificationsEnabled
                      ? 'Allowed. Calls can reach you.'
                      : 'Off. RINGO needs this to call you.',
                  },
                  ...(Platform.OS === 'android'
                    ? [
                        {
                          label: 'Exact alarms',
                          ok: capabilities?.exactAlarms ?? false,
                          detail: capabilities?.exactAlarms
                            ? 'Allowed. Calls are precisely timed.'
                            : 'Off. Android may delay calls.',
                        },
                        {
                          label: 'Full-screen calls',
                          ok: capabilities?.fullScreenIntent ?? false,
                          detail: capabilities?.fullScreenIntent
                            ? 'Allowed. Calls can appear over the lock screen.'
                            : 'Off. A high-priority alert is used instead.',
                        },
                      ]
                    : []),
                ].map((item) => (
                  <View key={item.label} style={styles.capRow}>
                    <View
                      style={[
                        styles.capIcon,
                        {
                          backgroundColor: item.ok ? colors.successSurface : colors.warningSurface,
                        },
                      ]}
                    >
                      <Ionicons
                        name={item.ok ? 'checkmark' : 'alert'}
                        size={14}
                        color={item.ok ? colors.success : colors.warning}
                      />
                    </View>
                    <View style={{ flex: 1, gap: 1 }}>
                      <AppText variant="bodyStrong">{item.label}</AppText>
                      <AppText variant="caption" color={colors.textSecondary}>
                        {item.detail}
                      </AppText>
                    </View>
                  </View>
                ))}
                <AppText variant="caption" color={colors.textMuted} style={{ marginTop: spacing.lg, lineHeight: 18 }}>
                  {Platform.OS === 'ios'
                    ? 'iOS uses its own notification system for reminders. A reminder call opens in RINGO when you tap the notification.'
                    : 'Android may restrict background apps on some manufacturers. RINGO asks for the exact permissions it needs — nothing more.'}
                </AppText>
              </View>
            ) : null}

            <View style={{ flex: 1, minHeight: spacing['3xl'] }} />

            <View style={styles.actions}>
              {step === 2 ? (
                <SecondaryButton
                  label="Check again"
                  icon="refresh"
                  onPress={() => refreshCapabilities()}
                  fullWidth={false}
                />
              ) : null}
              <PrimaryButton
                label={step === STEPS.length - 1 ? 'Start using RINGO' : 'Continue'}
                icon={step === STEPS.length - 1 ? 'checkmark' : 'arrow-forward'}
                onPress={next}
                loading={busy}
                fullWidth={false}
                style={{ minWidth: 180 }}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
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
  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
  },
  ringOne: {
    width: 430,
    height: 430,
    top: -180,
    right: -140,
  },
  ringTwo: {
    width: 620,
    height: 620,
    top: -280,
    right: -240,
  },
  glow: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    top: -110,
    right: -70,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 7,
    borderRadius: 4,
  },
  hero: {
    alignItems: 'center',
    marginTop: spacing['4xl'],
  },
  logoWrap: {
    width: 108,
    height: 108,
    borderRadius: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  body: {
    maxWidth: 360,
    marginTop: spacing.md,
  },
  nameLabel: {
    marginBottom: spacing.sm,
    letterSpacing: 1.2,
  },
  nameInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  nameInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
  },
  featureList: {
    marginTop: spacing['3xl'],
    gap: spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  capIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
});
