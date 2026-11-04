import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from '@/components/common/AppText';
import { useUiStore } from '@/store/uiStore';

export function Toast() {
  const toast = useUiStore((state) => state.toast);
  const clearToast = useUiStore((state) => state.clearToast);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-90)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!toast) return;
    translateY.setValue(-90);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        damping: 22,
        stiffness: 260,
        mass: 0.9,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -90,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => clearToast());
    }, 3400);

    return () => clearTimeout(timer);
  }, [clearToast, opacity, toast, translateY]);

  if (!toast) return null;

  const tint =
    toast.kind === 'error'
      ? colors.danger
      : toast.kind === 'success'
        ? colors.success
        : colors.text;
  const icon =
    toast.kind === 'error'
      ? 'alert-circle'
      : toast.kind === 'success'
        ? 'checkmark-circle'
        : 'information-circle';

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          top: insets.top + spacing.sm,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <Pressable
        accessibilityRole="alert"
        onPress={clearToast}
        style={[
          styles.toast,
          {
            backgroundColor: colors.surfaceAlt,
            borderColor: colors.border,
            shadowColor: colors.shadow,
          },
        ]}
      >
        <View style={[styles.icon, { backgroundColor: `${tint}1F` }]}>
          <Ionicons name={icon} size={16} color={tint} />
        </View>
        <AppText variant="caption" color={colors.text} style={{ flex: 1 }} weight="600">
          {toast.message}
        </AppText>
        <Ionicons name="close" size={14} color={colors.textMuted} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 1000,
    elevation: 1000,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    maxWidth: 520,
    width: '100%',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 8,
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
