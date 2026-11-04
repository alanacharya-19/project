import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { palette, radius } from '@/theme/tokens';

interface LogoProps {
  size?: number;
  color?: string;
  background?: string;
}

/**
 * The RINGO mark: a call ring with a centered pulse. Drawn from native views
 * so it stays crisp at every size and adds no image weight to the bundle.
 */
export function LogoMark({ size = 42, color, background }: LogoProps) {
  const { colors } = useTheme();
  const ringColor = color ?? colors.accent;
  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: background ?? 'transparent',
        },
      ]}
    >
      <View
        style={{
          width: size * 0.72,
          height: size * 0.72,
          borderRadius: size * 0.36,
          borderWidth: Math.max(2, size * 0.055),
          borderColor: ringColor,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: size * 0.19,
            height: size * 0.19,
            borderRadius: size * 0.1,
            backgroundColor: ringColor,
          }}
        />
      </View>
    </View>
  );
}

export function Wordmark({ size = 18, color, muted = false }: { size?: number; color?: string; muted?: boolean }) {
  const { colors } = useTheme();
  const textColor = color ?? (muted ? colors.textSecondary : colors.text);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.34 }}>
      <View
        style={{
          width: size * 0.22,
          height: size * 0.22,
          borderRadius: size * 0.11,
          backgroundColor: muted ? colors.textMuted : colors.accent,
        }}
      />
      <Text
        accessibilityRole="header"
        style={{
          color: textColor,
          fontSize: size,
          fontWeight: '800',
          letterSpacing: size * 0.1,
        }}
      >
        RINGO
      </Text>
    </View>
  );
}

export const logoColors = {
  coral: palette.coral,
  deep: palette.coralDeep,
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
});
