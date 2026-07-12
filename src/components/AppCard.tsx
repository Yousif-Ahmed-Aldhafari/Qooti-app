import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';

type AppCardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  accent?: 'default' | 'lime' | 'purple' | 'lavender';
};

export function AppCard({ children, style, accent = 'default' }: AppCardProps) {
  const backgroundColor = {
    default: colors.card,
    lime: colors.accent,
    purple: colors.purple,
    lavender: colors.lavender,
  }[accent];

  return <View style={[styles.card, { backgroundColor }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.2,
    shadowRadius: 26,
    elevation: 7,
  },
});
