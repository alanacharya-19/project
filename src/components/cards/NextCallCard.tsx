import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from '@/components/common/AppText';
import { LogoMark } from '@/components/common/Logo';
import type { UpcomingItem } from '@/features/reminders/utils/agenda';
import { formatCountdown, formatRelativeDay, formatTime } from '@/utils/date';
import { repeatDescription } from '@/utils/recurrence';
import { hapticTap } from '@/utils/haptics';

export function NextCallCard({ item, onPress }: { item: UpcomingItem; onPress: () => void }) {
  const { colors } = useTheme();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Next reminder call: ${item.reminder.title} at ${formatTime(item.occurrence, false)}`}
      onPress={() => {
        hapticTap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View pointerEvents="none" style={styles.decor}>
        <View style={[styles.ring, styles.ringLarge, { borderColor: `${colors.accent}18` }]} />
        <View style={[styles.ring, styles.ringSmall, { borderColor: `${colors.accent}26` }]} />
        <View style={[styles.ringDot, { backgroundColor: `${colors.accent}12` }]} />
      </View>

      <View style={styles.topRow}>
        <View style={[styles.callBadge, { backgroundColor: colors.accentSurface, borderColor: `${colors.accent}33` }]}>
          <View style={[styles.liveDot, { backgroundColor: colors.accent }]} />
          <AppText variant="micro" color={colors.accent}>
            NEXT REMINDER CALL
          </AppText>
        </View>
        <View style={styles.ringoPill}>
          <LogoMark size={22} color={colors.accent} />
          <AppText variant="caption" color={colors.textSecondary}>
            RINGO
          </AppText>
        </View>
      </View>

      <View style={styles.timeRow}>
        <AppText variant="hero" style={{ fontSize: 36, lineHeight: 40 }}>
          {formatTime(item.occurrence, false)}
        </AppText>
        <View style={[styles.countdown, { backgroundColor: colors.accentSurface }]}>
          <Ionicons name="hourglass-outline" size={12} color={colors.accent} />
          <AppText variant="caption" color={colors.accent} weight="700">
            in {formatCountdown(item.occurrence, now)}
          </AppText>
        </View>
      </View>

      <AppText variant="h3" numberOfLines={2} style={{ marginTop: spacing.xs }}>
        {item.reminder.title}
      </AppText>
      <AppText variant="body" color={colors.textSecondary} numberOfLines={2} style={{ marginTop: spacing.sm }}>
        {item.reminder.message}
      </AppText>

      <View style={styles.bottomRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
          <AppText variant="caption" color={colors.textMuted}>
            {formatRelativeDay(item.occurrence)} · {repeatDescription(item.reminder.repeatType, item.reminder.repeatDays)}
          </AppText>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <AppText variant="caption" color={colors.textMuted}>
            {item.snoozed ? 'Snoozed' : 'Edit'}
          </AppText>
          <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.xl,
    overflow: 'hidden',
  },
  decor: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'flex-end',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 999,
  },
  ringLarge: {
    width: 210,
    height: 210,
    right: -90,
    top: -75,
  },
  ringSmall: {
    width: 128,
    height: 128,
    right: -27,
    top: -18,
  },
  ringDot: {
    width: 62,
    height: 62,
    borderRadius: 31,
    right: 20,
    top: 28,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  callBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  ringoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  countdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.16)',
  },
});
