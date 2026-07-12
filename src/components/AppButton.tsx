import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { activeIsRTL, activeRowDirection } from '../utils/rtl';

type AppButtonProps = {
  title: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: 'primary' | 'secondary' | 'ghost';
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

export function AppButton({ title, onPress, icon, variant = 'primary', style }: AppButtonProps) {
  const rtl = activeIsRTL();
  const mirroredIcon = rtl && icon === 'arrow-forward' ? 'arrow-back' : rtl && icon === 'arrow-back' ? 'arrow-forward' : icon;
  const palette = {
    primary: { background: colors.accent, text: colors.black, border: colors.accent },
    secondary: { background: colors.card, text: colors.text, border: colors.border },
    ghost: { background: colors.cardMuted, text: colors.textSecondary, border: colors.cardMuted },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.background, borderColor: palette.border, flexDirection: activeRowDirection(), opacity: pressed ? 0.78 : 1 },
        style,
      ]}
    >
      {mirroredIcon ? <Ionicons name={mirroredIcon} color={palette.text} size={18} /> : null}
      <Text style={[styles.label, { color: palette.text }]} numberOfLines={1}>
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
  },
  label: {
    ...typography.body,
    fontWeight: '800',
    textAlign: 'center',
  },
});
