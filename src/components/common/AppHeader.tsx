import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';

type AppHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

export function AppHeader({ eyebrow, title, subtitle, action }: AppHeaderProps) {
  const theme = useAppTheme();
  const { rowDirectionStyle, textDirectionStyle } = useLanguage();

  return (
    <View style={[styles.header, rowDirectionStyle]}>
      <View style={styles.copy}>
        {eyebrow ? (
          <Text style={[styles.eyebrow, textDirectionStyle, { color: theme.colors.primary }]}>{eyebrow}</Text>
        ) : null}
        <Text style={[styles.title, textDirectionStyle, { color: theme.colors.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, textDirectionStyle, { color: theme.colors.textMuted }]}>{subtitle}</Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  copy: {
    flex: 1,
    gap: 5,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
});
