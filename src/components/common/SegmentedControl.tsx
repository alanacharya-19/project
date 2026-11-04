import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';
import { hapticTap } from '@/utils/haptics';

interface SegmentedControlProps<T extends string> {
  options: Array<{ value: T; label: string; icon?: React.ReactNode }>;
  value: T;
  onChange: (value: T) => void;
  style?: object;
}

export function SegmentedControl<T extends string>({ options, value, onChange, style }: SegmentedControlProps<T>) {
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: colors.surfaceMuted, borderColor: colors.borderSoft }, style]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) {
                hapticTap();
                onChange(option.value);
              }
            }}
            style={[
              styles.item,
              selected && { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {option.icon}
            <AppText
              variant="caption"
              color={selected ? colors.text : colors.textMuted}
              weight={selected ? '700' : '500'}
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function AppSwitch({
  value,
  onValueChange,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value }}
      onPress={() => {
        hapticTap();
        onValueChange(!value);
      }}
      style={[
        styles.switchWrap,
        { backgroundColor: value ? colors.accent : colors.surfaceMuted, borderColor: value ? colors.accent : colors.border },
      ]}
    >
      <View
        style={[
          styles.knob,
          {
            backgroundColor: value ? colors.background : colors.surfaceAlt,
            transform: [{ translateX: value ? 18 : 0 }],
          },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderRadius: radius.full,
    borderWidth: 1,
    padding: 3,
    gap: 3,
  },
  item: {
    flex: 1,
    minHeight: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: spacing.sm,
  },
  switchWrap: {
    width: 46,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    padding: 3,
    justifyContent: 'center',
  },
  knob: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
});
