import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import type { Translator } from '../i18n';
import { themeColors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type OnboardingScreenProps = {
  t: Translator;
  onDone: () => void;
};

export function OnboardingScreen({ t, onDone }: OnboardingScreenProps) {
  const colors = themeColors();
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.hero}>
        <View style={[styles.circle, { backgroundColor: colors.accent }]}>
          <Ionicons name="barbell-outline" size={82} color={colors.buttonText} />
        </View>
      </View>
      <AppCard style={styles.card}>
        <Text style={[styles.title, { color: colors.text }]}>{t('onboarding.title')}</Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>{t('onboarding.body')}</Text>
      </AppCard>
      <AppButton title={t('common.start')} icon="arrow-forward" onPress={onDone} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.xxl,
    padding: spacing.xl,
  },
  hero: {
    alignItems: 'center',
  },
  circle: {
    width: 250,
    height: 250,
    borderRadius: 125,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
  },
  title: {
    ...typography.title,
  },
  body: {
    ...typography.body,
  },
});
