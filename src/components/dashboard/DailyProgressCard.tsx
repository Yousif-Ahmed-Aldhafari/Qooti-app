import { StyleSheet, View } from 'react-native';

import { NutritionMacroDisplay } from '../meals/NutritionMacroDisplay';
import { SectionHeader } from '../common/SectionHeader';
import { useLanguage } from '../../hooks/useLanguage';
import type { NutritionTotals } from '../../utils/health';

type DailyProgressCardProps = {
  totals: NutritionTotals;
};

export function DailyProgressCard({ totals }: DailyProgressCardProps) {
  const { t } = useLanguage();

  return (
    <View style={styles.wrapper}>
      <SectionHeader title={t('dashboard.caloriesToday')} />
      <NutritionMacroDisplay totals={totals} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 12,
  },
});
