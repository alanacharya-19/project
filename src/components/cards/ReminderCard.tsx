import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from '@/components/common/AppText';
import { StatusPill } from '@/components/common/Chip';
import type { AgendaItem } from '@/features/reminders/utils/agenda';
import { PRIORITY_LABELS } from '@/constants/config';
import { formatTime } from '@/utils/date';
import { repeatDescription } from '@/utils/recurrence';
import { hapticTap } from '@/utils/haptics';
import { useSettingsStore } from '@/store/settingsStore';

interface ReminderCardProps {
  item: AgendaItem;
  onPress: () => void;
  compact?: boolean;
}

const STATUS_META: Record<
  AgendaItem['kind'],
  { label: string; colorKey: 'success' | 'danger' | 'warning' | 'accent' | 'textMuted'; icon: React.ComponentProps<typeof Ionicons>['name'] }
> = {
  scheduled: { label: '', colorKey: 'textMuted', icon: 'ellipse-outline' },
  ringing: { label: 'Calling now', colorKey: 'accent', icon: 'call' },
  answered: { label: 'Answered', colorKey: 'accent', icon: 'call-outline' },
  snoozed: { label: 'Snoozed', colorKey: 'warning', icon: 'time-outline' },
  completed: { label: 'Completed', colorKey: 'success', icon: 'checkmark-circle' },
  missed: { label: 'Missed', colorKey: 'danger', icon: 'alert-circle' },
  declined: { label: 'Declined', colorKey: 'textMuted', icon: 'close-circle' },
  dismissed: { label: 'Missed', colorKey: 'danger', icon: 'alert-circle' },
};

export function ReminderCard({ item, onPress, compact = false }: ReminderCardProps) {
  const { colors } = useTheme();
  const settings = useSettingsStore((state) => state.settings);
  const meta = STATUS_META[item.kind];
  const statusColor = colors[meta.colorKey];
  const future = item.occurrence.getTime() > Date.now();
  const important = item.reminder.priority !== 'normal';
  const priorityColor = item.reminder.priority === 'urgent' ? colors.danger : colors.warning;
  const statusLabel =
    item.kind === 'snoozed' && item.snoozedUntil
      ? `Snoozed · ${formatTime(item.snoozedUntil, false)}`
      : meta.label;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.reminder.title}, ${formatTime(item.occurrence, false)}${statusLabel ? `, ${statusLabel}` : ''}`}
      onPress={() => {
        hapticTap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.borderSoft,
          opacity: item.kind === 'missed' || item.kind === 'declined' ? 0.86 : pressed ? 0.72 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
        compact && styles.compact,
      ]}
    >
      {important ? <View style={[styles.priorityBar, { backgroundColor: priorityColor }]} /> : null}
      <View style={styles.timeColumn}>
        <AppText variant="h3" style={{ fontSize: 17 }}>
          {formatTime(item.occurrence, false)}
        </AppText>
        <AppText variant="caption" color={colors.textMuted}>
          {statusLabel || 'Reminder'}
        </AppText>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.borderSoft }]} />

      <View style={styles.content}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {item.kind !== 'scheduled' ? (
            <Ionicons name={meta.icon} size={14} color={statusColor} />
          ) : null}
          <AppText
            variant="bodyStrong"
            numberOfLines={1}
            style={{ flexShrink: 1, textDecorationLine: item.kind === 'completed' ? 'none' : undefined }}
          >
            {item.reminder.title}
          </AppText>
        </View>
        {!compact ? (
          <AppText variant="caption" color={colors.textSecondary} numberOfLines={1} style={{ marginTop: 2 }}>
            {item.reminder.message}
          </AppText>
        ) : null}
        <View style={styles.metaRow}>
          {item.reminder.repeatType !== 'never' ? (
            <View style={styles.repeatTag}>
              <Ionicons name="repeat" size={11} color={colors.textMuted} />
              <AppText variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>
                {repeatDescription(item.reminder.repeatType, item.reminder.repeatDays)}
              </AppText>
            </View>
          ) : null}
          {item.reminder.priority !== 'normal' ? (
            <StatusPill
              label={PRIORITY_LABELS[item.reminder.priority].toUpperCase()}
              color={priorityColor}
              background={`${priorityColor}18`}
              dot={false}
            />
          ) : null}
          {item.kind === 'completed' || item.kind === 'missed' ? (
            <StatusPill label={meta.label.toUpperCase()} color={statusColor} background={`${statusColor}18`} dot={false} />
          ) : null}
        </View>
      </View>

      {future ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 82,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: spacing.md,
    paddingRight: spacing.md,
    overflow: 'hidden',
  },
  compact: {
    minHeight: 64,
    paddingVertical: spacing.sm,
  },
  priorityBar: {
    width: 3,
    alignSelf: 'stretch',
    marginLeft: 1,
  },
  timeColumn: {
    width: 78,
    paddingLeft: spacing.md,
    gap: 1,
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    marginVertical: 2,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 3,
  },
  repeatTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
});
