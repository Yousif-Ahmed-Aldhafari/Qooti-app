import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppCard } from '../../components/common/AppCard';
import { AppHeader } from '../../components/common/AppHeader';
import { AppInput } from '../../components/common/AppInput';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { getFoodCatalog } from '../../data/seedData';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';

export function FoodSearchScreen() {
  const theme = useAppTheme();
  const { rowDirectionStyle, t, textDirectionStyle } = useLanguage();
  const [query, setQuery] = useState('');
  const foods = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return getFoodCatalog().filter((food) => !normalized || food.name.toLowerCase().includes(normalized));
  }, [query]);

  return (
    <ScreenContainer>
      <AppHeader title={t('navigation.foodSearch')} subtitle={t('meals.popularFoods')} />
      <AppInput label={t('common.search')} placeholder={t('meals.searchPlaceholder')} value={query} onChangeText={setQuery} />

      <View style={styles.list}>
        {foods.map((food) => (
          <AppCard key={food.id}>
            <View style={[styles.row, rowDirectionStyle]}>
              <View style={[styles.icon, { backgroundColor: theme.colors.accentMuted }]}>
                <Ionicons name="nutrition-outline" color={theme.colors.warning} size={22} />
              </View>
              <View style={styles.copy}>
                <Text style={[styles.title, textDirectionStyle, { color: theme.colors.text }]}>{food.name}</Text>
                <Text style={[styles.meta, textDirectionStyle, { color: theme.colors.textMuted }]}>
                  {food.unit} · {food.calories} {t('macros.kcal')} · {food.protein}{t('macros.grams')} {t('macros.protein')}
                </Text>
              </View>
              <Pressable style={[styles.pill, { backgroundColor: theme.colors.primaryMuted }]}>
                <Text style={[styles.pillText, { color: theme.colors.primary }]}>{t('meals.useFood')}</Text>
              </Pressable>
            </View>
          </AppCard>
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 12,
  },
  row: {
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 5,
  },
  title: {
    fontSize: 15,
    fontWeight: '900',
  },
  meta: {
    fontSize: 12,
    fontWeight: '700',
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '900',
  },
});
