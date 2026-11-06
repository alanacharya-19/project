import React from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';
import { hapticTap } from '@/utils/haptics';

export function FormField({
  label,
  hint,
  children,
  style,
}: {
  label?: string;
  hint?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.field, style]}>
      {label ? (
        <View style={styles.labelRow}>
          <AppText variant="caption" color={colors.textSecondary} weight="600">
            {label}
          </AppText>
          {hint ? (
            <AppText variant="caption" color={colors.textMuted}>
              {hint}
            </AppText>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function TextField({
  label,
  hint,
  containerStyle,
  ...props
}: TextInputProps & { label?: string; hint?: string; containerStyle?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <FormField label={label} hint={hint} style={containerStyle}>
      <View
        style={[
          styles.inputWrap,
          { backgroundColor: colors.surfaceAlt, borderColor: colors.borderSoft },
        ]}
      >
        <TextInput
          {...props}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { color: colors.text }, props.style]}
          selectionColor={colors.accent}
        />
      </View>
    </FormField>
  );
}

export function TextArea({
  label,
  hint,
  containerStyle,
  ...props
}: TextInputProps & { label?: string; hint?: string; containerStyle?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <FormField label={label} hint={hint} style={containerStyle}>
      <View
        style={[
          styles.inputWrap,
          styles.textAreaWrap,
          { backgroundColor: colors.surfaceAlt, borderColor: colors.borderSoft },
        ]}
      >
        <TextInput
          {...props}
          multiline
          textAlignVertical="top"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.textArea, { color: colors.text }, props.style]}
          selectionColor={colors.accent}
        />
      </View>
    </FormField>
  );
}

export function SliderRow({
  label,
  valueText,
  value,
  minimumValue,
  maximumValue,
  step,
  onValueChange,
  onSlidingComplete,
  disabled,
}: {
  label: string;
  valueText: string;
  value: number;
  minimumValue: number;
  maximumValue: number;
  step: number;
  onValueChange: (value: number) => void;
  onSlidingComplete?: (value: number) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.sliderRow}>
      <View style={styles.sliderHeader}>
        <AppText variant="caption" color={colors.textSecondary} weight="600">
          {label}
        </AppText>
        <AppText variant="caption" color={colors.textMuted}>
          {valueText}
        </AppText>
      </View>
      <Slider
        disabled={disabled}
        style={styles.slider}
        minimumValue={minimumValue}
        maximumValue={maximumValue}
        step={step}
        value={value}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.accent}
        onValueChange={onValueChange}
        onSlidingComplete={onSlidingComplete}
      />
    </View>
  );
}

export function SettingRow({
  icon,
  title,
  subtitle,
  right,
  onPress,
  destructive,
}: {
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
}) {
  const { colors } = useTheme();
  const content = (
    <>
      {icon ? (
        <View
          style={[
            styles.settingIcon,
            { backgroundColor: destructive ? colors.dangerSurface : colors.surfaceMuted },
          ]}
        >
          <Ionicons
            name={icon}
            size={17}
            color={destructive ? colors.danger : colors.textSecondary}
          />
        </View>
      ) : null}
      <View style={styles.settingText}>
        <AppText
          variant="bodyStrong"
          color={destructive ? colors.danger : colors.text}
          numberOfLines={1}
        >
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color={colors.textMuted} numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
    </>
  );

  if (!onPress) {
    return <View style={styles.settingRow}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => {
        hapticTap();
        onPress();
      }}
      style={({ pressed }) => [styles.settingRow, { opacity: pressed ? 0.6 : 1 }]}
    >
      {content}
    </Pressable>
  );
}

export function DayPicker({
  value,
  onChange,
  days,
}: {
  value: number[];
  onChange: (days: number[]) => void;
  days: Array<{ value: number; label: string }>;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.dayRow}>
      {days.map((day) => {
        const selected = value.includes(day.value);
        return (
          <Pressable
            key={day.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`Repeat on ${day.label}`}
            onPress={() => {
              hapticTap();
              onChange(
                selected
                  ? value.filter((item) => item !== day.value)
                  : [...value, day.value].sort(),
              );
            }}
            style={[
              styles.dayButton,
              {
                backgroundColor: selected ? colors.accent : colors.surfaceAlt,
                borderColor: selected ? colors.accent : colors.borderSoft,
              },
            ]}
          >
            <AppText
              variant="caption"
              color={selected ? '#FFF7F2' : colors.textSecondary}
              weight={selected ? '700' : '500'}
            >
              {day.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function FormDivider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.borderSoft }]} />;
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.sm,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  inputWrap: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    minHeight: 48,
  },
  textAreaWrap: {
    minHeight: 106,
    paddingVertical: spacing.md,
    justifyContent: 'flex-start',
  },
  input: {
    fontSize: 15,
    lineHeight: 21,
    paddingVertical: 0,
    minHeight: 44,
  },
  textArea: {
    minHeight: 84,
    paddingTop: 0,
  },
  sliderRow: {
    gap: 2,
  },
  sliderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  slider: {
    width: '100%',
    height: 34,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 58,
    paddingVertical: spacing.sm,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingText: {
    flex: 1,
    gap: 1,
  },
  dayRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  dayButton: {
    flex: 1,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    marginVertical: spacing.md,
  },
});
