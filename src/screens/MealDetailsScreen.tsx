import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppCard } from '../components/AppCard';
import { AppHeader } from '../components/AppHeader';
import { MacroCard } from '../components/MacroCard';
import type { Translator } from '../i18n';
import { themeColors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { Meal, UserProfile } from '../types';
import { calculateMealTotals } from '../utils/nutrition';
import { activeRowDirection, activeTextAlign, activeWritingDirection } from '../utils/rtl';

type MealDetailsScreenProps = {
  t: Translator;
  meal: Meal;
  profile: UserProfile;
};

export function MealDetailsScreen({ t, meal, profile }: MealDetailsScreenProps) {
  const colors = themeColors();
  const totals = calculateMealTotals(meal.items);
  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  return (
    <ScrollView style={[styles.screen, { backgroundColor: colors.background }]} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <AppHeader title={meal.title} subtitle={t('meals.detailsTitle')} />
      <View style={[styles.grid, { flexDirection: activeRowDirection() }]}>
        <MacroCard label={t('common.calories')} value={totals.calories} target={profile.targetCalories} unit={t('common.kcal')} />
        <MacroCard label={t('common.protein')} value={totals.protein} target={profile.targetProtein} unit={t('common.grams')} accent={colors.purple} />
        <MacroCard label={t('common.carbs')} value={totals.carbs} target={profile.targetCarbs} unit={t('common.grams')} accent={colors.lavender} />
        <MacroCard label={t('common.fats')} value={totals.fats} target={profile.targetFats} unit={t('common.grams')} accent={colors.orange} />
      </View>
      {meal.items.map((item) => (
        <AppCard key={item.id}>
          <Text style={[styles.itemTitle, directionalText, { color: colors.text }]}>{item.foodName}</Text>
          <Text style={[styles.itemMeta, directionalText, { color: colors.textMuted }]}>
            {item.quantity} - {item.calories} {t('common.kcal')} - {item.protein}{t('common.grams')} {t('common.protein')}
          </Text>
        </AppCard>
      ))}
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
  grid: {
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  itemTitle: {
    ...typography.h3,
  },
  itemMeta: {
    ...typography.body,
  },
});
