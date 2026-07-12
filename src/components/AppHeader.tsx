import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { themeColors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { activeRowStyle, activeTextAlign, activeWritingDirection } from '../utils/rtl';

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

export function AppHeader({ title, subtitle, action }: AppHeaderProps) {
  const colors = themeColors();
  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  return (
    <View style={[styles.header, activeRowStyle()]}>
      <View style={styles.copy}>
        <Text style={[styles.title, directionalText, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, directionalText, { color: colors.textMuted }]}>{subtitle}</Text> : null}
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
  },
  subtitle: {
    ...typography.body,
  },
});
