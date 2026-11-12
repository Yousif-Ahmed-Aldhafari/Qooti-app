import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { activeIsRTL, activeRowStyle, activeWritingDirection } from '../utils/rtl';
import { getPressFeedback } from '../utils/touchFeedback';

type AppButtonProps = {
  title: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

function mirrorDirectionalIcon(icon: keyof typeof Ionicons.glyphMap, rtl: boolean) {
  if (!rtl) {
    return icon;
  }

  const mirroredIcons: Partial<Record<keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap>> = {
    'arrow-forward': 'arrow-back',
    'arrow-back': 'arrow-forward',
    'chevron-forward': 'chevron-back',
    'chevron-back': 'chevron-forward',
  };

  return mirroredIcons[icon] ?? icon;
}

export function AppButton({ title, onPress, icon, variant = 'primary', disabled = false, style }: AppButtonProps) {
  const colors = themeColors();
  const rtl = activeIsRTL();
  const mirroredIcon = icon ? mirrorDirectionalIcon(icon, rtl) : undefined;
  const palette = {
    primary: {
      background: colors.accent,
      text: colors.buttonText,
      border: colors.accent,
      ripple: colors.accentDark ? `${colors.accentDark}40` : 'rgba(0, 0, 0, 0.15)',
    },
    secondary: {
      background: colors.card,
      text: colors.text,
      border: colors.border,
      ripple: `${colors.border}4D`,
    },
    ghost: {
      background: colors.cardMuted,
      text: colors.textSecondary,
      border: colors.cardMuted,
      ripple: `${colors.border}33`,
    },
    danger: {
      background: colors.card,
      text: colors.danger,
      border: colors.danger,
      ripple: `${colors.danger}26`,
    },
  }[variant];

  const { android_ripple, styleModifier } = getPressFeedback({
    rippleColor: palette.ripple,
    disabled,
    activeOpacity: 0.76,
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      android_ripple={android_ripple}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.background, borderColor: palette.border },
        styleModifier({ pressed }),
        activeRowStyle(),
        style,
      ]}
    >
      {mirroredIcon ? <Ionicons name={mirroredIcon} color={palette.text} size={18} /> : null}
      <Text style={[styles.label, { color: palette.text, writingDirection: activeWritingDirection() }]} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    overflow: 'hidden',
  },
  label: {
    ...typography.body,
    fontWeight: '800',
    textAlign: 'center',
  },
});
