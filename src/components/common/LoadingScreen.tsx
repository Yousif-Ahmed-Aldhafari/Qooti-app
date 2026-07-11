import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';

export function LoadingScreen() {
  const theme = useAppTheme();
  const { t, directionStyle, textDirectionStyle } = useLanguage();

  return (
    <View style={[styles.container, directionStyle, { backgroundColor: theme.colors.background }]}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={[styles.text, textDirectionStyle, { color: theme.colors.textMuted }]}>
        {t('common.loading')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  text: {
    fontSize: 14,
    fontWeight: '700',
  },
});
