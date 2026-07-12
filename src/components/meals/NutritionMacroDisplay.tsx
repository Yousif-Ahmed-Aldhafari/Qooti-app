import { StyleSheet, View } from 'react-native';

import { SummaryBox } from '../common/SummaryBox';
import { useLanguage } from '../../hooks/useLanguage';
import { roundNutrition, type NutritionTotals } from '../../utils/health';

type NutritionMacroDisplayProps = {
  totals: NutritionTotals;
};

export function NutritionMacroDisplay({ totals }: NutritionMacroDisplayProps) {
  const { t, rowDirectionStyle } = useLanguage();

  return (
    <View style={[styles.grid, rowDirectionStyle]}>
      <SummaryBox
        label={t('macros.calories')}
        value={Math.round(totals.calories)}
        helper={t('macros.kcal')}
        icon="flame-outline"
        tone="warning"
      />
      <SummaryBox
        label={t('macros.protein')}
        value={roundNutrition(totals.protein)}
        helper={t('macros.grams')}
        icon="barbell-outline"
        tone="success"
      />
      <SummaryBox
        label={t('macros.carbs')}
        value={roundNutrition(totals.carbs)}
        helper={t('macros.grams')}
        icon="leaf-outline"
        tone="secondary"
      />
      <SummaryBox
        label={t('macros.fat')}
        value={roundNutrition(totals.fat)}
        helper={t('macros.grams')}
        icon="water-outline"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexWrap: 'wrap',
    gap: 10,
  },
});
