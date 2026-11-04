import React from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';
import { typography } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

type Variant = keyof typeof typography;
type Weight = TextStyle['fontWeight'];

interface AppTextProps extends TextProps {
  variant?: Variant;
  color?: string;
  weight?: Weight;
  align?: TextStyle['textAlign'];
  opacify?: number;
}

export function AppText({
  variant = 'body',
  color,
  weight,
  align,
  opacify,
  style,
  children,
  ...rest
}: AppTextProps) {
  const { colors } = useTheme();
  return (
    <Text
      {...rest}
      style={[
        typography[variant],
        { color: color ?? colors.text, textAlign: align ?? 'left' },
        weight ? { fontWeight: weight } : null,
        opacify !== undefined ? { opacity: opacify } : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export const Heading = (props: Omit<AppTextProps, 'variant'> & { variant?: 'hero' | 'h1' | 'h2' | 'h3' }) =>
  AppText({ ...props, variant: props.variant ?? 'h1' });

export const Caption = (props: Omit<AppTextProps, 'variant'>) => AppText({ ...props, variant: 'caption' });
