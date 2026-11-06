import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from '@/components/common/AppText';
import { BottomSheet } from '@/components/modals/BottomSheet';
import { PrimaryButton, IconButton } from '@/components/common/Buttons';
import { Chip } from '@/components/common/Chip';
import { SegmentedControl } from '@/components/common/SegmentedControl';
import {
  DayPicker,
  FormDivider,
  FormField,
  SliderRow,
  TextArea,
  TextField,
} from '@/components/common/Form';
import {
  PRIORITY_LABELS,
  REPEAT_LABELS,
  RINGTONE_LABELS,
  SNOOZE_OPTIONS,
  SPEECH_PITCH_RANGE,
  SPEECH_RATE_RANGE,
  WEEKDAY_SHORT,
} from '@/constants/config';
import {
  combineDateAndTime,
  formatDateLong,
  formatRelativeDay,
  formatTime,
  isSameDay,
  startOfDay,
} from '@/utils/date';
import { nextOccurrence } from '@/utils/recurrence';
import {
  createReminder,
  deleteReminder,
  DuplicateReminderError,
  ReminderValidationError,
  updateReminder,
} from '@/features/reminders/services/reminderService';
import { getSystemVoices, previewSpeech, stopSpeech, type VoiceOption } from '@/features/voice/services/speech';
import { useRemindersStore } from '@/store/remindersStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useUiStore } from '@/store/uiStore';
import type { Priority, ReminderDraft, RepeatType, RingtoneId } from '@/types/reminder';

const REPEAT_ORDER: RepeatType[] = [
  'never',
  'daily',
  'weekdays',
  'weekends',
  'weekly',
  'monthly',
  'custom',
];

const PRIORITIES: Priority[] = ['normal', 'important', 'urgent'];
const RINGTONES: RingtoneId[] = ['default', 'alarm', 'ringtone', 'silent'];

function defaultStart(preset?: Date | null): { date: Date; time: Date } {
  const now = new Date();
  if (preset) {
    const date = startOfDay(preset);
    if (isSameDay(date, now)) {
      const time = new Date(now.getTime() + 10 * 60_000);
      time.setSeconds(0, 0);
      return { date: startOfDay(time), time };
    }
    const time = new Date(date);
    time.setHours(9, 0, 0, 0);
    return { date, time };
  }
  const rounded = new Date(now.getTime() + 12 * 60_000);
  rounded.setSeconds(0, 0);
  rounded.setMinutes(Math.ceil(rounded.getMinutes() / 5) * 5);
  return { date: startOfDay(rounded), time: rounded };
}

export function CreateReminderSheet() {
  const { colors, isDark } = useTheme();
  const visible = useUiStore((state) => state.createSheetOpen);
  const editing = useUiStore((state) => state.editingReminder);
  const presetDate = useUiStore((state) => state.presetDate);
  const closeCreate = useUiStore((state) => state.closeCreate);
  const showToast = useUiStore((state) => state.showToast);
  const refresh = useRemindersStore((state) => state.refresh);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [repeatType, setRepeatType] = useState<RepeatType>('never');
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [priority, setPriority] = useState<Priority>('normal');
  const [ringtone, setRingtone] = useState<RingtoneId>('default');
  const [snoozeMinutes, setSnoozeMinutes] = useState(10);
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [voiceName, setVoiceName] = useState<string | null>(null);
  const [speechRate, setSpeechRate] = useState(1);
  const [speechPitch, setSpeechPitch] = useState(1);
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const [voicePickerOpen, setVoicePickerOpen] = useState(false);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [voiceQuery, setVoiceQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    const now = new Date();
    const currentSettings = useSettingsStore.getState().settings;
    setError(null);
    setPicker(null);
    setVoicePickerOpen(false);
    setVoiceQuery('');

    if (editing) {
      let base = new Date(editing.scheduledAt);
      if (editing.repeatType !== 'never' && base.getTime() <= now.getTime()) {
        base = nextOccurrence(editing, now) ?? base;
      }
      if (base.getTime() <= now.getTime() + 30_000) {
        const fallback = defaultStart(presetDate);
        setDate(fallback.date);
        setTime(fallback.time);
      } else {
        setDate(startOfDay(base));
        setTime(base);
      }
      setTitle(editing.title);
      setMessage(editing.message);
      setRepeatType(editing.repeatType);
      setRepeatDays(editing.repeatDays);
      setPriority(editing.priority);
      setRingtone(editing.ringtone);
      setSnoozeMinutes(editing.snoozeMinutes);
      setVoiceId(editing.voiceId);
      setVoiceName(editing.voiceName);
      setSpeechRate(editing.speechRate);
      setSpeechPitch(editing.speechPitch);
    } else {
      const start = defaultStart(presetDate);
      setDate(start.date);
      setTime(start.time);
      setTitle('');
      setMessage('');
      setRepeatType('never');
      setRepeatDays([]);
      setPriority(currentSettings.defaultPriority);
      setRingtone(currentSettings.ringtone);
      setSnoozeMinutes(currentSettings.snoozeMinutes);
      setVoiceId(currentSettings.voiceId);
      setVoiceName(currentSettings.voiceName);
      setSpeechRate(currentSettings.speechRate);
      setSpeechPitch(currentSettings.speechPitch);
    }
  }, [editing, presetDate, visible]);

  useEffect(() => {
    if (!visible) {
      stopSpeech();
      return;
    }
    let cancelled = false;
    setVoicesLoading(true);
    getSystemVoices()
      .then((result) => {
        if (!cancelled) setVoices(result);
      })
      .finally(() => {
        if (!cancelled) setVoicesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, []);

  const filteredVoices = useMemo(() => {
    const query = voiceQuery.trim().toLowerCase();
    const sorted = voices.slice().sort((a, b) => {
      const current = Platform.OS === 'ios' ? 'en-' : 'en';
      const aLocal = a.language.toLowerCase().startsWith(current) ? 0 : 1;
      const bLocal = b.language.toLowerCase().startsWith(current) ? 0 : 1;
      if (aLocal !== bLocal) return aLocal - bLocal;
      return a.name.localeCompare(b.name);
    });
    if (!query) return sorted;
    return sorted.filter(
      (voice) =>
        voice.name.toLowerCase().includes(query) ||
        voice.language.toLowerCase().includes(query),
    );
  }, [voiceQuery, voices]);

  const scheduledAt = useMemo(() => combineDateAndTime(date, time), [date, time]);
  const selectedVoice = voiceName ?? 'Device default';

  const buildDraft = (): ReminderDraft => ({
    title: title.trim(),
    message: message.trim(),
    scheduledAt: scheduledAt.toISOString(),
    repeatType,
    repeatDays,
    priority,
    voiceId,
    voiceName,
    speechRate,
    speechPitch,
    snoozeMinutes,
    ringtone,
  });

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const draft = buildDraft();
      const currentSettings = useSettingsStore.getState().settings;
      const result = editing
        ? await updateReminder(editing, draft, currentSettings)
        : await createReminder(draft, currentSettings);
      await refresh();
      closeCreate();
      if (result.schedule.warning) {
        showToast(result.schedule.warning, 'default');
      } else {
        showToast(editing ? 'Reminder updated.' : 'Reminder scheduled.', 'success');
      }
    } catch (caught) {
      if (__DEV__) console.warn('RINGO could not save the reminder', caught);
      const message =
        caught instanceof DuplicateReminderError
          ? caught.message
          : caught instanceof ReminderValidationError
            ? caught.message
            : 'RINGO could not save this reminder. Check the details and try again.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!editing) return;
    Alert.alert(
      'Delete this reminder?',
      'The reminder stops calling you. Its past call history stays in Events.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteReminder(editing);
              await refresh();
              closeCreate();
              showToast('Reminder deleted.');
            } catch {
              showToast('Could not delete the reminder.', 'error');
            }
          },
        },
      ],
    );
  };

  const previewMessage = async () => {
    const text = message.trim() || title.trim();
    if (!text) {
      showToast('Add a message for RINGO to read first.');
      return;
    }
    await previewSpeech(text, { rate: speechRate, pitch: speechPitch, voiceId });
  };

  const renderVoicePicker = () => (
    <View style={{ gap: spacing.md }}>
      <Pressable
        onPress={() => setVoicePickerOpen(false)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 }}
      >
        <Ionicons name="chevron-back" size={16} color={colors.accent} />
        <AppText variant="caption" color={colors.accent}>
          Back to reminder details
        </AppText>
      </Pressable>

      <View
        style={[
          styles.searchWrap,
          { backgroundColor: colors.surfaceAlt, borderColor: colors.borderSoft },
        ]}
      >
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          value={voiceQuery}
          onChangeText={setVoiceQuery}
          placeholder="Search voices or languages"
          placeholderTextColor={colors.textMuted}
          style={[styles.searchInput, { color: colors.text }]}
          selectionColor={colors.accent}
        />
      </View>

      <AppText variant="caption" color={colors.textMuted}>
        {voicesLoading
          ? 'Loading voices from your device…'
          : `${filteredVoices.length} system voice${filteredVoices.length === 1 ? '' : 's'}`}
      </AppText>

      <ScrollView
        style={{ maxHeight: 380 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {filteredVoices.length === 0 && !voicesLoading ? (
          <AppText variant="body" color={colors.textSecondary} style={{ paddingVertical: spacing.lg }}>
            No matching voices. Your device may only expose a few offline voices.
          </AppText>
        ) : null}
        {filteredVoices.map((voice) => {
          const selected = voiceId === voice.identifier;
          return (
            <View
              key={voice.identifier}
              style={[styles.voiceRow, { borderBottomColor: colors.borderSoft }]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  setVoiceId(voice.identifier);
                  setVoiceName(voice.name);
                }}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
              >
                <View
                  style={[
                    styles.voiceCheck,
                    {
                      borderColor: selected ? colors.accent : colors.border,
                      backgroundColor: selected ? colors.accent : 'transparent',
                    },
                  ]}
                >
                  {selected ? <Ionicons name="checkmark" size={13} color="#FFF7F2" /> : null}
                </View>
                <View style={{ flex: 1, gap: 1 }}>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {voice.name}
                  </AppText>
                  <AppText variant="caption" color={colors.textMuted}>
                    {voice.language}
                    {voice.quality !== 'Default' ? ` · ${voice.quality}` : ''}
                  </AppText>
                </View>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Preview ${voice.name}`}
                onPress={() =>
                  previewSpeech('This is how RINGO will read your reminder.', {
                    rate: speechRate,
                    pitch: speechPitch,
                    voiceId: voice.identifier,
                  })
                }
                style={[styles.previewButton, { backgroundColor: colors.surfaceMuted }]}
              >
                <Ionicons name="play" size={13} color={colors.textSecondary} />
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      <Pressable
        onPress={() => {
          setVoiceId(null);
          setVoiceName(null);
        }}
        style={{ paddingVertical: spacing.md }}
      >
        <AppText variant="caption" color={colors.accent}>
          Use the device default voice
        </AppText>
      </Pressable>
    </View>
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={closeCreate}
      eyebrow={voicePickerOpen ? 'VOICE' : editing ? 'EDIT REMINDER' : 'NEW REMINDER'}
      title={voicePickerOpen ? 'Choose a voice' : editing ? 'Adjust the call' : 'Schedule a call'}
      scrollable={!voicePickerOpen}
      footer={
        voicePickerOpen ? (
          <PrimaryButton label="Done" onPress={() => setVoicePickerOpen(false)} />
        ) : (
          <View style={styles.footer}>
            {editing ? (
              <IconButton
                icon="trash-outline"
                accessibilityLabel="Delete reminder"
                onPress={handleDelete}
                color={colors.danger}
                background={colors.dangerSurface}
              />
            ) : null}
            <View style={{ flex: 1 }}>
              <PrimaryButton
                label={editing ? 'Save changes' : 'Schedule reminder call'}
                icon="call"
                onPress={handleSave}
                loading={saving}
              />
            </View>
          </View>
        )
      }
    >
      {voicePickerOpen ? (
        renderVoicePicker()
      ) : (
        <View style={{ gap: spacing.lg }}>
          {error ? (
            <View
              style={[
                styles.errorBox,
                { backgroundColor: colors.dangerSurface, borderColor: `${colors.danger}44` },
              ]}
            >
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <AppText variant="caption" color={colors.danger} style={{ flex: 1 }}>
                {error}
              </AppText>
            </View>
          ) : null}

          <TextField
            label="REMINDER TITLE"
            placeholder="Call Mom about dinner"
            value={title}
            onChangeText={setTitle}
            maxLength={80}
            returnKeyType="next"
          />

          <TextArea
            label="WHAT SHOULD RINGO SAY?"
            hint={`${message.length}/500`}
            placeholder="Something warm, specific, and easy to act on."
            value={message}
            onChangeText={setMessage}
            maxLength={500}
          />

          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Preview spoken reminder"
              onPress={previewMessage}
              style={[styles.previewAction, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
            >
              <Ionicons name="volume-high-outline" size={16} color={colors.accent} />
              <AppText variant="caption" color={colors.text} weight="600">
                Hear it
              </AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose speaking voice"
              onPress={() => setVoicePickerOpen(true)}
              style={[
                styles.previewAction,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceAlt,
                  flex: 1,
                  justifyContent: 'flex-start',
                },
              ]}
            >
              <Ionicons name="mic-outline" size={16} color={colors.textSecondary} />
              <AppText variant="caption" color={colors.textSecondary} numberOfLines={1} style={{ flex: 1 }}>
                {selectedVoice}
              </AppText>
              <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
            </Pressable>
          </View>

          <FormDivider />

          <FormField
            label="WHEN"
            hint={formatRelativeDay(scheduledAt)}
          >
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Choose date, currently ${formatDateLong(date)}`}
                onPress={() => setPicker(picker === 'date' ? null : 'date')}
                style={[
                  styles.dateButton,
                  {
                    backgroundColor: colors.surfaceAlt,
                    borderColor: picker === 'date' ? colors.accent : colors.borderSoft,
                  },
                ]}
              >
                <Ionicons name="calendar-outline" size={15} color={colors.textSecondary} />
                <AppText variant="caption" color={colors.text} weight="600">
                  {formatDateLong(date)}
                </AppText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Choose time, currently ${formatTime(time, false)}`}
                onPress={() => setPicker(picker === 'time' ? null : 'time')}
                style={[
                  styles.timeButton,
                  {
                    backgroundColor: colors.surfaceAlt,
                    borderColor: picker === 'time' ? colors.accent : colors.borderSoft,
                  },
                ]}
              >
                <Ionicons name="time-outline" size={15} color={colors.textSecondary} />
                <AppText variant="caption" color={colors.text} weight="600">
                  {formatTime(time, false)}
                </AppText>
              </Pressable>
            </View>

            {picker ? (
              <View
                style={[
                  styles.pickerWrap,
                  { backgroundColor: colors.surfaceAlt, borderColor: colors.borderSoft },
                ]}
              >
                <DateTimePicker
                  value={picker === 'date' ? date : time}
                  mode={picker}
                  display={Platform.OS === 'ios' ? (picker === 'date' ? 'inline' : 'spinner') : 'default'}
                  themeVariant={isDark ? 'dark' : 'light'}
                  minimumDate={picker === 'date' ? startOfDay(new Date()) : undefined}
                  onChange={(event, selected) => {
                    if (Platform.OS === 'android') {
                      setPicker(null);
                      if (event.type === 'dismissed') return;
                    }
                    if (!selected) return;
                    if (picker === 'date') {
                      setDate(startOfDay(selected));
                    } else {
                      const merged = combineDateAndTime(date, selected);
                      setTime(merged);
                    }
                  }}
                />
                {Platform.OS === 'ios' ? (
                  <Pressable
                    onPress={() => setPicker(null)}
                    style={[styles.pickerDone, { backgroundColor: colors.accentSurface }]}
                  >
                    <AppText variant="caption" color={colors.accent} weight="700">
                      Done
                    </AppText>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </FormField>

          <FormField label="REPEAT">
            <View style={styles.chipWrap}>
              {REPEAT_ORDER.map((type) => (
                <Chip
                  key={type}
                  label={REPEAT_LABELS[type]}
                  selected={repeatType === type}
                  onPress={() => {
                    setRepeatType(type);
                    if (type === 'custom' && repeatDays.length === 0) {
                      setRepeatDays([new Date(scheduledAt).getDay()]);
                    }
                  }}
                />
              ))}
            </View>
            {repeatType === 'custom' ? (
              <DayPicker
                days={WEEKDAY_SHORT.map((label, value) => ({ value, label }))}
                value={repeatDays}
                onChange={setRepeatDays}
              />
            ) : null}
          </FormField>

          <FormField label="PRIORITY">
            <SegmentedControl
              options={PRIORITIES.map((value) => ({ value, label: PRIORITY_LABELS[value] }))}
              value={priority}
              onChange={setPriority}
            />
          </FormField>

          <FormField label="IF I MISS IT, SNOOZE FOR">
            <View style={styles.chipWrap}>
              {SNOOZE_OPTIONS.map((minutes) => (
                <Chip
                  key={minutes}
                  label={`${minutes} min`}
                  selected={snoozeMinutes === minutes}
                  onPress={() => setSnoozeMinutes(minutes)}
                />
              ))}
            </View>
          </FormField>

          <FormField label="CALL SOUND">
            <View style={styles.chipWrap}>
              {RINGTONES.map((id) => (
                <Chip
                  key={id}
                  label={RINGTONE_LABELS[id]}
                  selected={ringtone === id}
                  onPress={() => setRingtone(id)}
                />
              ))}
            </View>
            {Platform.OS === 'ios' && ringtone !== 'silent' ? (
              <AppText variant="caption" color={colors.textMuted}>
                iOS uses its built-in notification sound. Custom tones are managed in iOS Settings.
              </AppText>
            ) : null}
          </FormField>

          <FormDivider />

          <FormField label="SPEECH" hint="Applies to this reminder">
            <View style={{ gap: spacing.sm }}>
              <SliderRow
                label="Speed"
                valueText={`${speechRate.toFixed(2)}×`}
                value={speechRate}
                minimumValue={SPEECH_RATE_RANGE.min}
                maximumValue={SPEECH_RATE_RANGE.max}
                step={SPEECH_RATE_RANGE.step}
                onValueChange={setSpeechRate}
              />
              <SliderRow
                label="Pitch"
                valueText={speechPitch.toFixed(2)}
                value={speechPitch}
                minimumValue={SPEECH_PITCH_RANGE.min}
                maximumValue={SPEECH_PITCH_RANGE.max}
                step={SPEECH_PITCH_RANGE.step}
                onValueChange={setSpeechPitch}
              />
            </View>
          </FormField>
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  previewAction: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  dateButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timeButton: {
    minWidth: 112,
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pickerWrap: {
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    paddingBottom: spacing.sm,
    alignItems: 'center',
  },
  pickerDone: {
    alignSelf: 'flex-end',
    marginRight: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    minHeight: 46,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 10,
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  voiceCheck: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
