import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';

type AppCardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'surface' | 'primary' | 'accent' | 'dark';
};

export function AppCard({ children, style, tone = 'surface' }: AppCardProps) {
  const theme = useAppTheme();
  const { contentDirectionStyle } = useLanguage();
  const toneStyle = {
    surface: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
    },
    primary: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    accent: {
      backgroundColor: theme.colors.accentMuted,
      borderColor: theme.colors.accentMuted,
    },
    dark: {
      backgroundColor: theme.colors.text,
      borderColor: theme.colors.text,
    },
  }[tone];

  return (
    <View
      style={[
        styles.card,
        contentDirectionStyle,
        toneStyle,
        {
          shadowColor: theme.colors.shadow,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 14,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
});
