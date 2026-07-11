import { StyleSheet, Text, View } from 'react-native';

import type { FoodItem } from '../../models/meal';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';

type FoodItemRowProps = {
  item: FoodItem;
};

export function FoodItemRow({ item }: FoodItemRowProps) {
  const theme = useAppTheme();
  const { rowDirectionStyle, textDirectionStyle, t } = useLanguage();

  return (
    <View style={[styles.row, rowDirectionStyle, { borderColor: theme.colors.border }]}>
      <View style={styles.text}>
        <Text style={[styles.name, textDirectionStyle, { color: theme.colors.text }]} numberOfLines={1}>
          {item.name || t('meals.foodName')}
        </Text>
        <Text style={[styles.meta, textDirectionStyle, { color: theme.colors.textMuted }]}>
          {item.quantity} {item.unit}
        </Text>
      </View>
      <Text style={[styles.nutrition, textDirectionStyle, { color: theme.colors.primary }]}>
        {Math.round(item.calories)} {t('macros.kcal')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderTopWidth: 1,
    paddingVertical: 12,
    gap: 10,
  },
  text: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 15,
    fontWeight: '800',
  },
  meta: {
    fontSize: 13,
  },
  nutrition: {
    maxWidth: 96,
    fontSize: 13,
    fontWeight: '900',
  },
});
