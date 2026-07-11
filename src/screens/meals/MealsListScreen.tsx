import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppButton } from '../../components/common/AppButton';
import { EmptyState } from '../../components/common/EmptyState';
import { ListItem } from '../../components/common/ListItem';
import { Screen } from '../../components/common/Screen';
import { SectionHeader } from '../../components/common/SectionHeader';
import { useApp } from '../../store/AppContext';
import { useLanguage } from '../../hooks/useLanguage';
import type { RootStackParamList } from '../../navigation/types';
import { compareDateTimeDesc, formatDisplayDate } from '../../utils/date';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function MealsListScreen() {
  const navigation = useNavigation<Navigation>();
  const { meals } = useApp();
  const { t, language } = useLanguage();
  const sortedMeals = [...meals].sort(compareDateTimeDesc);

  return (
    <Screen>
      <SectionHeader
        title={t('meals.title')}
        action={
          <AppButton
            title={t('common.add')}
            icon="add"
            onPress={() => navigation.navigate('AddEditMeal')}
            style={styles.headerButton}
          />
        }
      />

      {sortedMeals.length ? (
        <View style={styles.list}>
          {sortedMeals.map((meal) => (
            <ListItem
              key={meal.id}
              title={meal.name}
              subtitle={`${formatDisplayDate(meal.date, language)} - ${meal.time} - ${t('meals.itemsCount', {
                count: meal.items.length,
              })}`}
              meta={`${Math.round(meal.totalCalories)} ${t('macros.kcal')}`}
              icon="restaurant-outline"
              onPress={() => navigation.navigate('MealDetails', { mealId: meal.id })}
            />
          ))}
        </View>
      ) : (
        <EmptyState
          icon="restaurant-outline"
          title={t('meals.emptyTitle')}
          message={t('meals.emptyMessage')}
          actionLabel={t('meals.addTitle')}
          onAction={() => navigation.navigate('AddEditMeal')}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    minHeight: 40,
    paddingHorizontal: 14,
  },
  list: {
    gap: 10,
  },
});
