import { Alert, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppHeader } from '../../components/common/AppHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { MacroCard } from '../../components/common/MacroCard';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { FoodItemRow } from '../../components/meals/FoodItemRow';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';
import type { RootStackParamList } from '../../navigation/types';
import { useApp } from '../../store/AppContext';
import { formatDisplayDate } from '../../utils/date';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'MealDetails'>;
type MealDetailsRoute = RouteProp<RootStackParamList, 'MealDetails'>;

export function MealDetailsScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<MealDetailsRoute>();
  const { deleteMeal, meals, profile } = useApp();
  const theme = useAppTheme();
  const { language, rowDirectionStyle, t, textDirectionStyle } = useLanguage();
  const meal = meals.find((item) => item.id === route.params.mealId);

  if (!meal) {
    return (
      <ScreenContainer>
        <EmptyState title={t('common.notFound')} message={t('meals.emptyMessage')} />
      </ScreenContainer>
    );
  }

  const currentMeal = meal;

  function confirmDelete() {
    Alert.alert(t('meals.deleteMeal'), t('meals.deleteMealMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          deleteMeal(currentMeal.id);
          navigation.goBack();
        },
      },
    ]);
  }

  return (
    <ScreenContainer>
      <AppHeader title={currentMeal.name} subtitle={`${formatDisplayDate(currentMeal.date, language)} · ${currentMeal.time}`} />

      <View style={[styles.grid, rowDirectionStyle]}>
        <MacroCard label={t('macros.calories')} value={currentMeal.totalCalories} goal={profile.targetCalories} unit={t('macros.kcal')} icon="flame-outline" color={theme.colors.warning} />
        <MacroCard label={t('macros.protein')} value={currentMeal.totalProtein} goal={profile.targetProtein} unit={t('macros.grams')} icon="barbell-outline" />
        <MacroCard label={t('macros.carbs')} value={currentMeal.totalCarbs} goal={profile.targetCarbs} unit={t('macros.grams')} icon="leaf-outline" color={theme.colors.accent} />
        <MacroCard label={t('macros.fat')} value={currentMeal.totalFat} goal={profile.targetFat} unit={t('macros.grams')} icon="water-outline" color={theme.colors.secondary} />
      </View>

      <AppCard>
        <Text style={[styles.sectionTitle, textDirectionStyle, { color: theme.colors.text }]}>
          {t('meals.foodItems')}
        </Text>
        {currentMeal.items.length ? (
          currentMeal.items.map((item) => <FoodItemRow key={item.id} item={item} />)
        ) : (
          <Text style={[styles.empty, textDirectionStyle, { color: theme.colors.textMuted }]}>
            {t('meals.noItems')}
          </Text>
        )}
      </AppCard>

      <View style={[styles.actions, rowDirectionStyle]}>
        <AppButton title={t('common.edit')} icon="create-outline" variant="secondary" onPress={() => navigation.navigate('AddEditMeal', { mealId: currentMeal.id })} style={styles.action} />
        <AppButton title={t('common.delete')} icon="trash-outline" variant="danger" onPress={confirmDelete} style={styles.action} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
  actions: {
    gap: 12,
  },
  action: {
    flex: 1,
  },
});
