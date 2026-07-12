import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import type { Translator } from '../i18n';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type OnboardingScreenProps = {
  t: Translator;
  onDone: () => void;
};

export function OnboardingScreen({ t, onDone }: OnboardingScreenProps) {
  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.circle}>
          <Ionicons name="barbell-outline" size={82} color={colors.black} />
        </View>
      </View>
      <AppCard accent="lime" style={styles.card}>
        <Text style={styles.title}>{t('onboarding.title')}</Text>
        <Text style={styles.body}>{t('onboarding.body')}</Text>
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
    backgroundColor: colors.background,
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
    backgroundColor: colors.accent,
  },
  card: {
    backgroundColor: colors.card,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  body: {
    ...typography.body,
    color: colors.textMuted,
  },
});
