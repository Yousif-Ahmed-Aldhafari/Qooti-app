import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { AppHeader } from '../components/AppHeader';
import { MacroCard } from '../components/MacroCard';
import { StatCard } from '../components/StatCard';
import type { Translator } from '../i18n';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { UserProfile } from '../types';
import { activeRowDirection, activeTextAlign, activeWritingDirection } from '../utils/rtl';

type ProfileScreenProps = {
  t: Translator;
  profile: UserProfile;
  onSettingsPress: () => void;
};

export function ProfileScreen({ t, profile, onSettingsPress }: ProfileScreenProps) {
  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <AppHeader
        title={t('profile.title')}
        subtitle={t('profile.subtitle')}
        action={<AppButton title={t('common.settings')} icon="settings-outline" variant="secondary" onPress={onSettingsPress} />}
      />

      <AppCard>
        <View style={[styles.profileRow, { flexDirection: activeRowDirection() }]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profile.avatarInitials}</Text>
          </View>
          <View style={styles.copy}>
            <Text style={[styles.name, directionalText]}>{profile.name}</Text>
            <Text style={[styles.email, directionalText]}>{profile.email}</Text>
          </View>
        </View>
        <View style={styles.divider} />
        <Text style={[styles.label, directionalText]}>{t('profile.goal')}</Text>
        <Text style={[styles.goal, directionalText]}>{profile.goal}</Text>
      </AppCard>

      <View style={[styles.statsRow, { flexDirection: activeRowDirection() }]}>
        <StatCard label={t('profile.height')} value={`${profile.heightCm} ${t('common.cm')}`} />
        <StatCard label={t('profile.weight')} value={`${profile.weightKg} ${t('common.kg')}`} accent={colors.lavender} />
      </View>

      <Text style={[styles.sectionTitle, directionalText]}>{t('profile.targets')}</Text>
      <View style={[styles.grid, { flexDirection: activeRowDirection() }]}>
        <MacroCard label={t('common.calories')} value={profile.targetCalories} target={profile.targetCalories} unit={t('common.kcal')} />
        <MacroCard label={t('common.protein')} value={profile.targetProtein} target={profile.targetProtein} unit={t('common.grams')} accent={colors.purple} />
        <MacroCard label={t('common.carbs')} value={profile.targetCarbs} target={profile.targetCarbs} unit={t('common.grams')} accent={colors.lavender} />
        <MacroCard label={t('common.fats')} value={profile.targetFats} target={profile.targetFats} unit={t('common.grams')} accent={colors.orange} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: 120,
    gap: spacing.lg,
  },
  profileRow: {
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  avatarText: {
    ...typography.h2,
    color: colors.black,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
  name: {
    ...typography.h2,
    color: colors.text,
  },
  email: {
    ...typography.body,
    color: colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
  },
  goal: {
    ...typography.body,
    color: colors.text,
  },
  statsRow: {
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
  },
  grid: {
    flexWrap: 'wrap',
    gap: spacing.md,
  },
});
