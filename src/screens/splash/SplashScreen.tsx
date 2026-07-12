import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppCard } from '../../components/common/AppCard';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';

export function SplashScreen() {
  const theme = useAppTheme();
  const { t, textDirectionStyle } = useLanguage();

  return (
    <ScreenContainer scroll={false} contentStyle={styles.content}>
      <View style={styles.brandWrap}>
        <View style={[styles.logo, { backgroundColor: theme.colors.primary }]}>
          <Ionicons name="flash" size={38} color="#FFFFFF" />
        </View>
        <Text style={[styles.name, textDirectionStyle, { color: theme.colors.text }]}>{t('app.name')}</Text>
      </View>

      <AppCard tone="dark" style={styles.card}>
        <Text style={[styles.headline, textDirectionStyle, { color: theme.colors.surface }]}>
          {t('splash.headline')}
        </Text>
        <Text style={[styles.subline, textDirectionStyle, { color: theme.colors.accent }]}>
          {t('splash.subline')}
        </Text>
      </AppCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'center',
    paddingBottom: 24,
  },
  brandWrap: {
    alignItems: 'center',
    gap: 14,
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 38,
    fontWeight: '900',
    textAlign: 'center',
  },
  card: {
    marginTop: 36,
    padding: 24,
  },
  headline: {
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 37,
  },
  subline: {
    fontSize: 14,
    fontWeight: '800',
  },
});
