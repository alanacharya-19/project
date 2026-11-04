import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

interface SurfaceProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  variant?: 'default' | 'alt' | 'accent' | 'muted';
  border?: boolean;
}

export function Surface({ children, style, padding = spacing.lg, variant = 'default', border = true }: SurfaceProps) {
  const { colors } = useTheme();
  const background =
    variant === 'accent'
      ? colors.accentSurface
      : variant === 'muted'
        ? colors.surfaceMuted
        : variant === 'alt'
          ? colors.surfaceAlt
          : colors.surface;
  return (
    <View
      style={[
        styles.surface,
        {
          backgroundColor: background,
          padding,
          borderWidth: border ? 1 : 0,
          borderColor: variant === 'accent' ? `${colors.accent}33` : colors.borderSoft,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View style={[{ height: 1, backgroundColor: colors.borderSoft }, style]} />;
}

const styles = StyleSheet.create({
  surface: {
    borderRadius: radius.lg,
  },
});
