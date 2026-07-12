import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { Translator } from '../i18n';
import { themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type SplashScreenProps = {
  t: Translator;
};

export function SplashScreen({ t }: SplashScreenProps) {
  const colors = themeColors();
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.logo, { backgroundColor: colors.accent }]}>
        <Ionicons name="flash" size={42} color={colors.buttonText} />
      </View>
      <Text style={[styles.name, { color: colors.text }]}>{t('app.name')}</Text>
      <Text style={[styles.title, { color: colors.text }]}>{t('splash.title')}</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('splash.subtitle')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xxl,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    ...typography.title,
    textAlign: 'center',
  },
  title: {
    ...typography.h2,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    textAlign: 'center',
  },
});
