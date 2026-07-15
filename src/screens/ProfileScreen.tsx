import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { AppHeader } from '../components/AppHeader';
import { MacroCard } from '../components/MacroCard';
import { StatCard } from '../components/StatCard';
import { useBottomNavScrollHandler } from '../context/BottomNavContext';
import type { Translator } from '../i18n';
import { themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { UserProfile } from '../types';
import { activeRowStyle, activeTextAlign, activeWritingDirection } from '../utils/rtl';

type ProfileScreenProps = {
  t: Translator;
  profile: UserProfile;
  onSettingsPress: () => void;
};

export function ProfileScreen({ t, profile, onSettingsPress }: ProfileScreenProps) {
  const colors = themeColors();
  const handleBottomNavScroll = useBottomNavScrollHandler();
  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      onScroll={handleBottomNavScroll}
      scrollEventThrottle={16}
    >
      <AppHeader
        title={t('profile.title')}
        subtitle={t('profile.subtitle')}
        action={<AppButton title={t('common.settings')} icon="settings-outline" variant="secondary" onPress={onSettingsPress} />}
      />

      <AppCard>
        <View style={[styles.profileRow, activeRowStyle()]}>
          <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
            <Text style={[styles.avatarText, { color: colors.buttonText }]}>{profile.avatarInitials}</Text>
          </View>
          <View style={styles.copy}>
            <Text style={[styles.name, directionalText, { color: colors.text }]}>{profile.name}</Text>
            <Text style={[styles.email, directionalText, { color: colors.textMuted }]}>{profile.email}</Text>
          </View>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Text style={[styles.label, directionalText, { color: colors.textMuted }]}>{t('profile.goal')}</Text>
        <Text style={[styles.goal, directionalText, { color: colors.text }]}>{profile.goal}</Text>
      </AppCard>

      <View style={[styles.statsRow, activeRowStyle()]}>
        <StatCard label={t('profile.height')} value={`${profile.heightCm} ${t('common.cm')}`} />
        <StatCard label={t('profile.weight')} value={`${profile.weightKg} ${t('common.kg')}`} accent={colors.lavender} />
      </View>

      <Text style={[styles.sectionTitle, directionalText, { color: colors.text }]}>{t('profile.targets')}</Text>
      <View style={[styles.grid, activeRowStyle()]}>
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
  },
  avatarText: {
    ...typography.h2,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
  name: {
    ...typography.h2,
  },
  email: {
    ...typography.body,
  },
  divider: {
    height: 1,
  },
  label: {
    ...typography.caption,
  },
  goal: {
    ...typography.body,
  },
  statsRow: {
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
  },
  grid: {
    flexWrap: 'wrap',
    gap: spacing.md,
  },
});
