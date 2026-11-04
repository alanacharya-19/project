import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';
import { hapticTap } from '@/utils/haptics';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface ButtonProps {
  label: string;
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
}

export function PrimaryButton({
  label,
  onPress,
  icon,
  disabled,
  loading,
  style,
  fullWidth = true,
}: ButtonProps) {
  const { colors, isDark } = useTheme();
  const foreground = isDark ? '#140A07' : '#FFF9F5';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={() => {
        hapticTap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.primary,
        {
          backgroundColor: disabled ? colors.surfaceMuted : colors.accent,
          opacity: pressed ? 0.86 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={foreground} /> : null}
          <AppText variant="bodyStrong" style={{ color: foreground }}>
            {label}
          </AppText>
        </>
      )}
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, icon, disabled, style, fullWidth = true }: ButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => {
        hapticTap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.secondary,
        {
          borderColor: colors.border,
          backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
          opacity: disabled ? 0.45 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={18} color={colors.text} /> : null}
      <AppText variant="bodyStrong">{label}</AppText>
    </Pressable>
  );
}

interface IconButtonProps {
  icon: IconName;
  onPress: () => void;
  size?: number;
  color?: string;
  background?: string;
  accessibilityLabel: string;
  disabled?: boolean;
}

export function IconButton({
  icon,
  onPress,
  size = 40,
  color,
  background,
  accessibilityLabel,
  disabled,
}: IconButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={() => {
        hapticTap();
        onPress();
      }}
      hitSlop={8}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: background ?? colors.surface,
          borderWidth: background ? 0 : 1,
          borderColor: colors.borderSoft,
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={size * 0.46} color={color ?? colors.text} />
    </Pressable>
  );
}

interface CircleActionProps {
  icon: IconName;
  onPress: () => void;
  label: string;
  backgroundColor: string;
  iconColor: string;
  size?: number;
  disabled?: boolean;
}

export function CircleAction({
  icon,
  onPress,
  label,
  backgroundColor,
  iconColor,
  size = 68,
  disabled,
}: CircleActionProps) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: spacing.sm }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={() => {
          hapticTap();
          onPress();
        }}
        style={({ pressed }) => ({
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.4 : pressed ? 0.78 : 1,
          transform: [{ scale: pressed ? 0.95 : 1 }],
        })}
      >
        <Ionicons name={icon} size={size * 0.4} color={iconColor} />
      </Pressable>
      <AppText variant="caption" color={colors.textSecondary}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  primary: {
    minHeight: 54,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  secondary: {
    minHeight: 50,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
});
