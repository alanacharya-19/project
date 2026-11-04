import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';
import { PrimaryButton } from './Buttons';

interface EmptyStateProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

export function EmptyState({ icon, title, message, actionLabel, onAction, compact }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, compact && { paddingVertical: spacing['2xl'] }]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.accentSurface, borderColor: `${colors.accent}2A` }]}>
        <Ionicons name={icon} size={26} color={colors.accent} />
      </View>
      <AppText variant="h3" align="center" style={{ marginTop: spacing.md }}>
        {title}
      </AppText>
      <AppText variant="body" align="center" color={colors.textSecondary} style={styles.message}>
        {message}
      </AppText>
      {actionLabel && onAction ? (
        <PrimaryButton label={actionLabel} onPress={onAction} fullWidth={false} style={{ marginTop: spacing.lg }} />
      ) : null}
    </View>
  );
}

export function ListRow({
  icon,
  title,
  subtitle,
  right,
  onPress,
  accessibilityLabel,
}: {
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const content = (
    <>
      {icon ? (
        <View style={[styles.rowIcon, { backgroundColor: colors.surfaceMuted }]}>
          <Ionicons name={icon} size={17} color={colors.textSecondary} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyStrong">{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" color={colors.textSecondary}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
    </>
  );
  if (!onPress) {
    return <View style={styles.row}>{content}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.65 : 1 }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing['3xl'],
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  message: {
    maxWidth: 280,
    marginTop: 6,
  },
  row: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
