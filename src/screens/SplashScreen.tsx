import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { Translator } from '../i18n';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type SplashScreenProps = {
  t: Translator;
};

export function SplashScreen({ t }: SplashScreenProps) {
  return (
    <View style={styles.screen}>
      <View style={styles.logo}>
        <Ionicons name="flash" size={42} color={colors.black} />
      </View>
      <Text style={styles.name}>{t('app.name')}</Text>
      <Text style={styles.title}>{t('splash.title')}</Text>
      <Text style={styles.subtitle}>{t('splash.subtitle')}</Text>
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
    backgroundColor: colors.background,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  name: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
  },
  title: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
