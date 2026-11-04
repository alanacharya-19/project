import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
}

export function Chip({ label, selected, onPress, accentColor, style }: ChipProps) {
  const { colors } = useTheme();
  const accent = accentColor ?? colors.accent;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? (accentColor ? `${accent}22` : colors.accentSurface) : colors.surface,
          borderColor: selected ? accent : colors.border,
          opacity: pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      <AppText
        variant="label"
        color={selected ? accent : colors.textSecondary}
        style={{ fontWeight: selected ? '700' : '600' }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

interface StatusPillProps {
  label: string;
  color?: string;
  background?: string;
  dot?: boolean;
}

export function StatusPill({ label, color, background, dot = true }: StatusPillProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: background ?? colors.surfaceMuted }]}>
      {dot ? <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color ?? colors.textSecondary }} /> : null}
      <AppText variant="micro" color={color ?? colors.textSecondary}>
        {label}
      </AppText>
    </View>
  );
}

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function SectionHeader({ title, actionLabel, onAction, style }: SectionHeaderProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.section, style]}>
      <AppText variant="micro" color={colors.textMuted}>
        {title}
      </AppText>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={10}>
          <AppText variant="caption" color={colors.accent} weight="700">
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingHorizontal: 2,
  },
});
