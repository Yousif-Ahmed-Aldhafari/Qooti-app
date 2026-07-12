import { StyleSheet, Text, View } from 'react-native';

import { AppCard } from '../../components/common/AppCard';
import { AppHeader } from '../../components/common/AppHeader';
import { MacroCard } from '../../components/common/MacroCard';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { FoodItemRow } from '../../components/meals/FoodItemRow';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';
import { useApp } from '../../store/AppContext';
import { mealsForToday, nutritionTotalsForMeals } from '../../utils/health';

export function NutritionSummaryScreen() {
  const { meals, profile } = useApp();
  const theme = useAppTheme();
  const { rowDirectionStyle, t, textDirectionStyle } = useLanguage();
  const todayMeals = mealsForToday(meals);
  const totals = nutritionTotalsForMeals(todayMeals);

  return (
    <ScreenContainer>
      <AppHeader title={t('nutrition.title')} subtitle={t('nutrition.subtitle')} />

      <AppCard tone="primary">
        <Text style={[styles.heroLabel, textDirectionStyle]}>{t('nutrition.calorieBudget')}</Text>
        <Text style={[styles.heroValue, textDirectionStyle]}>
          {Math.round(totals.calories)} / {profile.targetCalories} {t('macros.kcal')}
        </Text>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              {
                width: `${Math.min(100, (totals.calories / profile.targetCalories) * 100)}%`,
                backgroundColor: theme.colors.accent,
              },
            ]}
          />
        </View>
      </AppCard>

      <View style={[styles.grid, rowDirectionStyle]}>
        <MacroCard label={t('nutrition.proteinGoal')} value={totals.protein} goal={profile.targetProtein} unit={t('macros.grams')} icon="barbell-outline" />
        <MacroCard label={t('nutrition.carbGoal')} value={totals.carbs} goal={profile.targetCarbs} unit={t('macros.grams')} icon="leaf-outline" color={theme.colors.accent} />
        <MacroCard label={t('nutrition.fatGoal')} value={totals.fat} goal={profile.targetFat} unit={t('macros.grams')} icon="water-outline" color={theme.colors.secondary} />
      </View>

      <AppCard>
        <Text style={[styles.sectionTitle, textDirectionStyle, { color: theme.colors.text }]}>
          {t('nutrition.loggedMeals')}
        </Text>
        {todayMeals.length ? (
          todayMeals.flatMap((meal) => meal.items.map((item) => <FoodItemRow key={`${meal.id}-${item.id}`} item={item} />))
        ) : (
          <Text style={[styles.empty, textDirectionStyle, { color: theme.colors.textMuted }]}>
            {t('dashboard.noMealsToday')}
          </Text>
        )}
      </AppCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heroLabel: {
    color: '#EAF3FF',
    fontSize: 14,
    fontWeight: '900',
  },
  heroValue: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
  },
  track: {
    height: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.24)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
  grid: {
    flexWrap: 'wrap',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  empty: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
  },
});
