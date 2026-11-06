import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_VERSION, PRIORITY_LABELS, RINGTONE_LABELS, SNOOZE_OPTIONS, SPEECH_PITCH_RANGE, SPEECH_RATE_RANGE } from '@/constants/config';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from '@/components/common/AppText';
import { Screen, ScreenHeader } from '@/components/common/Screen';
import { Surface } from '@/components/common/Surface';
import { SectionHeader, Chip, StatusPill } from '@/components/common/Chip';
import { SegmentedControl, AppSwitch } from '@/components/common/SegmentedControl';
import { SettingRow, SliderRow, TextField } from '@/components/common/Form';
import { PrimaryButton } from '@/components/common/Buttons';
import { VoicePickerSheet } from '@/features/voice/components/VoicePickerSheet';
import { previewSpeech } from '@/features/voice/services/speech';
import { isActiveReminder } from '@/features/reminders/utils/agenda';
import { rescheduleReminder } from '@/features/reminders/services/reminderService';
import { useCapabilities } from '@/services/permissions/hooks';
import {
  notificationPermissionGranted,
  openBatteryOptimizationSettings,
  openExactAlarmSettings,
  openFullScreenIntentSettings,
  openNotificationSettings,
  requestNotificationPermission,
} from '@/services/permissions';
import { useSettingsStore } from '@/store/settingsStore';
import { useRemindersStore } from '@/store/remindersStore';
import { useUiStore } from '@/store/uiStore';
import type { Priority, RingtoneId } from '@/types/reminder';
import type { ThemeMode } from '@/theme/tokens';
import { hapticSuccess } from '@/utils/haptics';

type ThemeOption = 'system' | ThemeMode;
const THEME_OPTIONS: Array<{ value: ThemeOption; label: string }> = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];
const PRIORITIES: Priority[] = ['normal', 'important', 'urgent'];
const RINGTONES: RingtoneId[] = ['default', 'alarm', 'ringtone', 'silent'];

export default function SettingsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const settings = useSettingsStore((state) => state.settings);
  const update = useSettingsStore((state) => state.update);
  const updateMany = useSettingsStore((state) => state.updateMany);
  const refreshReminders = useRemindersStore((state) => state.refresh);
  const showToast = useUiStore((state) => state.showToast);
  const { capabilities, refreshing, refresh } = useCapabilities();

  const [name, setName] = useState(settings.name);
  const [rate, setRate] = useState(settings.speechRate);
  const [pitch, setPitch] = useState(settings.speechPitch);
  const [voicePickerOpen, setVoicePickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(settings.name);
    setRate(settings.speechRate);
    setPitch(settings.speechPitch);
  }, [settings.name, settings.speechPitch, settings.speechRate]);

  const saveName = async () => {
    if (name.trim() === settings.name) return;
    await update('name', name.trim());
  };

  const testVoice = async () => {
    await previewSpeech(
      `Hi${name.trim() ? ` ${name.trim()}` : ''}, this is RINGO. This is how your reminder will sound.`,
      { rate, pitch, voiceId: settings.voiceId },
    );
  };

  const applyRepeatMissed = async (value: boolean) => {
    setBusy(true);
    try {
      await update('repeatMissedCall', value);
      const nextSettings = { ...settings, repeatMissedCall: value };
      const reminders = useRemindersStore.getState().reminders.filter(isActiveReminder);
      for (const reminder of reminders) {
        try {
          await rescheduleReminder(reminder, nextSettings);
        } catch {
          // Keep applying the setting even if one reminder cannot be rescheduled.
        }
      }
      await refreshReminders();
      showToast(
        value
          ? 'RINGO will call once more if you miss a call.'
          : 'Missed calls will no longer be repeated.',
      );
    } finally {
      setBusy(false);
    }
  };

  const fixNotifications = async () => {
    let granted = await notificationPermissionGranted();
    if (!granted) granted = await requestNotificationPermission();
    if (!granted) {
      await openNotificationSettings();
      return;
    }
    await hapticSuccess();
    await refresh();
    showToast('Notifications are enabled.', 'success');
  };

  const clearOnboarding = () => {
    Alert.alert(
      'Replay the introduction?',
      'The welcome walkthrough will open again so you can review permissions and setup.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replay',
          onPress: async () => {
            await update('onboardingComplete', false);
          },
        },
      ],
    );
  };

  const notificationOk = capabilities?.notificationsEnabled ?? false;
  const exactOk = capabilities?.exactAlarms ?? false;
  const fullScreenOk = capabilities?.fullScreenIntent ?? false;
  const nativeOk = capabilities?.nativeAndroid ?? false;
  const batteryOk = capabilities ? !capabilities.batteryOptimized : false;
  const isAndroid = capabilities?.platform === 'android';

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingBottom: insets.bottom + 118,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              refresh();
            }}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        <ScreenHeader
          left={
            <View style={{ gap: 4 }}>
              <AppText variant="micro" color={colors.textMuted}>
                MAKE RINGO YOURS
              </AppText>
              <AppText variant="h1">Settings</AppText>
            </View>
          }
          right={
            <View style={[styles.profileBadge, { backgroundColor: colors.accentSurface }]}>
              <Ionicons name="person" size={14} color={colors.accent} />
              <AppText variant="caption" color={colors.accent} weight="700" numberOfLines={1}>
                {settings.name.trim() || 'You'}
              </AppText>
            </View>
          }
          style={{ paddingHorizontal: 0, paddingTop: spacing.md }}
        />

        <Surface style={{ marginTop: spacing.md, gap: spacing.md }}>
          <TextField
            label="YOUR NAME"
            hint="Used in greetings"
            value={name}
            onChangeText={setName}
            onBlur={saveName}
            placeholder="What should RINGO call you?"
            maxLength={40}
            returnKeyType="done"
          />
          <View style={{ gap: spacing.sm }}>
            <AppText variant="caption" color={colors.textSecondary} weight="600">
              APPEARANCE
            </AppText>
            <SegmentedControl
              options={THEME_OPTIONS}
              value={settings.themePreference}
              onChange={(value) => update('themePreference', value)}
            />
          </View>
        </Surface>

        <View style={{ marginTop: spacing['2xl'] }}>
          <SectionHeader title="VOICE" actionLabel="Preview" onAction={testVoice} />
          <Surface style={{ gap: spacing.md }}>
            <SettingRow
              icon="mic-outline"
              title="Speaking voice"
              subtitle={settings.voiceName ?? 'Device default voice'}
              onPress={() => setVoicePickerOpen(true)}
              right={<Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
            />
            <View style={[styles.hairline, { backgroundColor: colors.borderSoft }]} />
            <SliderRow
              label="Speed"
              valueText={`${rate.toFixed(2)}×`}
              value={rate}
              minimumValue={SPEECH_RATE_RANGE.min}
              maximumValue={SPEECH_RATE_RANGE.max}
              step={SPEECH_RATE_RANGE.step}
              onValueChange={setRate}
              onSlidingComplete={(value) => update('speechRate', value)}
            />
            <SliderRow
              label="Pitch"
              valueText={pitch.toFixed(2)}
              value={pitch}
              minimumValue={SPEECH_PITCH_RANGE.min}
              maximumValue={SPEECH_PITCH_RANGE.max}
              step={SPEECH_PITCH_RANGE.step}
              onValueChange={setPitch}
              onSlidingComplete={(value) => update('speechPitch', value)}
            />
            <PrimaryButton label="Hear this voice" icon="volume-high" onPress={testVoice} />
          </Surface>
        </View>

        <View style={{ marginTop: spacing['2xl'] }}>
          <SectionHeader title="CALL DEFAULTS" />
          <Surface style={{ gap: spacing.lg }}>
            <View style={{ gap: spacing.sm }}>
              <AppText variant="caption" color={colors.textSecondary} weight="600">
                RINGTONE
              </AppText>
              <View style={styles.chipWrap}>
                {RINGTONES.map((id) => (
                  <Chip
                    key={id}
                    label={RINGTONE_LABELS[id]}
                    selected={settings.ringtone === id}
                    onPress={() => update('ringtone', id)}
                  />
                ))}
              </View>
            </View>

            <View style={{ gap: spacing.sm }}>
              <AppText variant="caption" color={colors.textSecondary} weight="600">
                SNOOZE LENGTH
              </AppText>
              <View style={styles.chipWrap}>
                {SNOOZE_OPTIONS.map((minutes) => (
                  <Chip
                    key={minutes}
                    label={`${minutes} min`}
                    selected={settings.snoozeMinutes === minutes}
                    onPress={() => update('snoozeMinutes', minutes)}
                  />
                ))}
              </View>
            </View>

            <View style={{ gap: spacing.sm }}>
              <AppText variant="caption" color={colors.textSecondary} weight="600">
                DEFAULT PRIORITY
              </AppText>
              <SegmentedControl
                options={PRIORITIES.map((value) => ({ value, label: PRIORITY_LABELS[value] }))}
                value={settings.defaultPriority}
                onChange={(value) => update('defaultPriority', value)}
              />
            </View>

            <View style={[styles.hairline, { backgroundColor: colors.borderSoft }]} />
            <SettingRow
              icon="repeat"
              title="Call again if missed"
              subtitle="A second call two minutes after an unanswered reminder."
              right={
                <AppSwitch
                  value={settings.repeatMissedCall}
                  onValueChange={applyRepeatMissed}
                  accessibilityLabel="Repeat missed calls"
                />
              }
            />
            {busy ? (
              <AppText variant="caption" color={colors.textMuted}>
                Applying to your active reminders…
              </AppText>
            ) : null}
            <AppText variant="caption" color={colors.textMuted}>
              Defaults apply to new reminders. Snooze and repeat changes are applied to active calls.
            </AppText>
          </Surface>
        </View>

        <View style={{ marginTop: spacing['2xl'] }}>
          <SectionHeader
            title="RELIABILITY"
            actionLabel={refreshing ? 'Checking…' : 'Refresh'}
            onAction={refresh}
          />
          <Surface style={{ gap: 2 }}>
            <SettingRow
              icon={notificationOk ? 'notifications' : 'notifications-off'}
              title="Notifications"
              subtitle={
                notificationOk
                  ? 'Allowed. RINGO can reach you.'
                  : 'Off. RINGO cannot call you until this is allowed.'
              }
              onPress={fixNotifications}
              right={
                <StatusPill
                  label={notificationOk ? 'ON' : 'FIX'}
                  color={notificationOk ? colors.success : colors.danger}
                  background={notificationOk ? colors.successSurface : colors.dangerSurface}
                />
              }
            />
            {isAndroid ? (
              <>
                <SettingRow
                  icon="alarm"
                  title="Exact alarms"
                  subtitle={
                    exactOk
                      ? 'Allowed. Calls are precisely timed.'
                      : 'Off. Android may delay calls by minutes.'
                  }
                  onPress={openExactAlarmSettings}
                  right={
                    <StatusPill
                      label={exactOk ? 'ON' : 'FIX'}
                      color={exactOk ? colors.success : colors.warning}
                      background={exactOk ? colors.successSurface : colors.warningSurface}
                    />
                  }
                />
                <SettingRow
                  icon="phone-portrait"
                  title="Full-screen calls"
                  subtitle={
                    nativeOk
                      ? fullScreenOk
                        ? 'Allowed. Calls can take over the lock screen.'
                        : 'Off. Calls show as high-priority alerts instead.'
                      : 'Needs the RINGO development build.'
                  }
                  onPress={openFullScreenIntentSettings}
                  right={
                    <StatusPill
                      label={fullScreenOk ? 'ON' : 'FIX'}
                      color={fullScreenOk ? colors.success : colors.warning}
                      background={fullScreenOk ? colors.successSurface : colors.warningSurface}
                    />
                  }
                />
                <SettingRow
                  icon="battery-half"
                  title="Battery optimization"
                  subtitle={
                    batteryOk
                      ? 'Unrestricted. Background calls are protected.'
                      : 'Restricted. Some phones may hold back alarms.'
                  }
                  onPress={openBatteryOptimizationSettings}
                  right={
                    <StatusPill
                      label={batteryOk ? 'OK' : 'FIX'}
                      color={batteryOk ? colors.success : colors.warning}
                      background={batteryOk ? colors.successSurface : colors.warningSurface}
                    />
                  }
                />
                {capabilities?.doNotDisturb ? (
                  <SettingRow
                    icon="moon"
                    title="Do Not Disturb is on"
                    subtitle="The system may mute the call sound. RINGO still delivers the call."
                    right={
                      <StatusPill
                        label="INFO"
                        color={colors.info}
                        background={colors.infoSurface}
                      />
                    }
                  />
                ) : null}
              </>
            ) : (
              <SettingRow
                icon="information-circle-outline"
                title="iOS notifications"
                subtitle="iOS delivers reminder calls through its notification system. Opening a notification brings you into the call screen."
                right={<StatusPill label="SYSTEM" color={colors.textMuted} />}
              />
            )}
            {capabilities?.missingConfiguration.length ? (
              <View style={[styles.noteBox, { backgroundColor: colors.warningSurface }]}>
                <Ionicons name="alert-circle-outline" size={15} color={colors.warning} />
                <AppText variant="caption" color={colors.warning} style={{ flex: 1 }}>
                  {capabilities.missingConfiguration[0]}
                </AppText>
              </View>
            ) : null}
          </Surface>
        </View>

        <View style={{ marginTop: spacing['2xl'] }}>
          <SectionHeader title="ABOUT" />
          <Surface style={{ gap: 2 }}>
            <SettingRow
              icon="sparkles-outline"
              title="Replay introduction"
              subtitle="See the welcome walkthrough and permission check again."
              onPress={clearOnboarding}
              right={<Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
            />
            <SettingRow
              icon="shield-checkmark-outline"
              title="Privacy"
              subtitle="Reminders and call history are stored only on this device. No microphone, no analytics, no account."
            />
            <SettingRow
              icon="code-slash-outline"
              title="Version"
              subtitle={`RINGO ${APP_VERSION} · Expo SDK 58`}
              right={<StatusPill label="LOCAL" color={colors.textMuted} />}
            />
          </Surface>
        </View>

        <Pressable
          onPress={() => router.navigate('/events')}
          style={[styles.historyLink, { borderColor: colors.borderSoft }]}
        >
          <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
          <AppText variant="caption" color={colors.textSecondary}>
            Review your call history in Events
          </AppText>
          <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
        </Pressable>

        <AppText
          variant="caption"
          color={colors.textMuted}
          align="center"
          style={{ marginTop: spacing.lg, lineHeight: 18 }}
        >
          RINGO respects OS limits: no app can call through a force-stopped Android app or
          override a silenced iPhone.
        </AppText>
      </ScrollView>

      <VoicePickerSheet
        visible={voicePickerOpen}
        onClose={() => setVoicePickerOpen(false)}
        selectedId={settings.voiceId}
        rate={rate}
        pitch={pitch}
        onSelect={(voice) => {
          updateMany({
            voiceId: voice?.identifier ?? null,
            voiceName: voice?.name ?? null,
            voiceLanguage: voice?.language ?? null,
          });
          showToast(voice ? `Voice set to ${voice.name}.` : 'Using the device default voice.');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 34,
    maxWidth: 130,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  hairline: {
    height: 1,
    marginVertical: spacing.xs,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
  },
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing['2xl'],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});
