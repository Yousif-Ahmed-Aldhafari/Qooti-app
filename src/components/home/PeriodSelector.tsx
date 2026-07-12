import { Pressable, StyleSheet, Text, View } from 'react-native';

import { themeColors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { activeRowDirection, activeWritingDirection } from '../../utils/rtl';

export type PeriodKey = 'today' | 'week' | 'month';

type PeriodOption = {
  key: PeriodKey;
  label: string;
};

type PeriodSelectorProps = {
  options: PeriodOption[];
  selected: PeriodKey;
  onChange: (period: PeriodKey) => void;
};

type PeriodFilterButtonProps = {
  label: string;
  value: PeriodKey;
  selected: boolean;
  onPress: () => void;
};

export function PeriodFilterButton({ label, value, selected, onPress }: PeriodFilterButtonProps) {
  const colors = themeColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      testID={`period-filter-${value}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: selected ? colors.primary : colors.white,
          borderColor: colors.primary,
          opacity: pressed ? 0.78 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            color: selected ? colors.white : colors.primary,
            writingDirection: activeWritingDirection(),
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function PeriodSelector({ options, selected, onChange }: PeriodSelectorProps) {
  return (
    <View style={[styles.wrap, { flexDirection: activeRowDirection() }]}>
      {options.map((option) => (
        <PeriodFilterButton
          key={option.key}
          label={option.label}
          value={option.key}
          selected={option.key === selected}
          onPress={() => onChange(option.key)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  pill: {
    minHeight: 38,
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  label: {
    ...typography.body,
    fontWeight: '800',
  },
});
