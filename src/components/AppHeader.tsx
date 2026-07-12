import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { activeRowDirection, activeTextAlign, activeWritingDirection } from '../utils/rtl';

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

export function AppHeader({ title, subtitle, action }: AppHeaderProps) {
  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  return (
    <View style={[styles.header, { flexDirection: activeRowDirection() }]}>
      <View style={styles.copy}>
        <Text style={[styles.title, directionalText]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, directionalText]}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
  },
});
