import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';

type IconName = keyof typeof Ionicons.glyphMap;
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type AppButtonProps = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

export function AppButton({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  style,
}: AppButtonProps) {
  const theme = useAppTheme();
  const { rowDirection, writingDirection } = useLanguage();

  const colors = {
    primary: {
      background: theme.colors.primary,
      text: '#FFFFFF',
      border: theme.colors.primary,
    },
    secondary: {
      background: theme.colors.primaryMuted,
      text: theme.colors.primary,
      border: theme.colors.primaryMuted,
    },
    ghost: {
      background: 'transparent',
      text: theme.colors.primary,
      border: theme.colors.border,
    },
    danger: {
      background: theme.colors.danger,
      text: '#FFFFFF',
      border: theme.colors.danger,
    },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          flexDirection: rowDirection,
          backgroundColor: colors.background,
          borderColor: colors.border,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={18} color={colors.text} /> : null}
      <Text style={[styles.label, { color: colors.text, writingDirection }]} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
  },
});
