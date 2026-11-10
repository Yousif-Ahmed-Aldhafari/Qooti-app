import { ScrollView, StyleSheet } from 'react-native';

import { AppButton } from '../components/AppButton';
import { AppHeader } from '../components/AppHeader';
import { EmptyState } from '../components/EmptyState';
import { MealCard } from '../components/MealCard';
import { useBottomNavScrollHandler } from '../context/BottomNavContext';
import type { Translator } from '../i18n';
import { themeColors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { Meal } from '../types';

type MealsScreenProps = {
  t: Translator;
  meals: Meal[];
  onAddMeal: () => void;
  onMealPress: (meal: Meal) => void;
};

export function MealsScreen({ t, meals, onAddMeal, onMealPress }: MealsScreenProps) {
  const colors = themeColors();
  const handleBottomNavScroll = useBottomNavScrollHandler();

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      onScroll={handleBottomNavScroll}
      scrollEventThrottle={16}
    >
      <AppHeader title={t('meals.title')} subtitle={t('meals.subtitle')} action={<AppButton title={t('common.add')} icon="add" onPress={onAddMeal} />} />
      {meals.length ? (
        meals.map((meal) => (
          <MealCard key={meal.id} meal={meal} caloriesLabel={t('common.kcal')} itemLabel={t('meals.itemLabel')} onPress={() => onMealPress(meal)} />
        ))
      ) : (
        <EmptyState
          icon="restaurant-outline"
          title={t('meals.emptyTitle')}
          description={t('meals.emptyMessage')}
          actionTitle={t('meals.addTitle')}
          actionIcon="add"
          onAction={onAddMeal}
        />
      )}
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
});
