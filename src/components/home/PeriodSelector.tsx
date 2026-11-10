import { Pressable, StyleSheet, Text, View } from 'react-native';

import { themeColors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import type { Language } from '../../types';
import { rowStyle, writingDirection } from '../../utils/rtl';
import { calculateHitSlop, getPressFeedback } from '../../utils/touchFeedback';

export type PeriodKey = 'today' | 'week' | 'month';

type PeriodOption = {
  key: PeriodKey;
  label: string;
};

type PeriodSelectorProps = {
  options: PeriodOption[];
  selected: PeriodKey;
  onChange: (period: PeriodKey) => void;
  language?: Language;
};

type PeriodFilterButtonProps = {
  label: string;
  value: PeriodKey;
  selected: boolean;
  onPress: () => void;
  language?: Language;
};

export function PeriodFilterButton({ label, value, selected, onPress, language }: PeriodFilterButtonProps) {
  const colors = themeColors();
  const { android_ripple, styleModifier } = getPressFeedback({
    rippleColor: selected ? 'rgba(255, 255, 255, 0.25)' : `${colors.primary}26`,
    activeOpacity: 0.78,
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      testID={`period-filter-${value}`}
      hitSlop={calculateHitSlop(80, 40)}
      android_ripple={android_ripple}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: selected ? colors.primary : colors.filterInactiveBackground,
        },
        styleModifier({ pressed }),
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            color: selected ? colors.white : colors.primary,
            writingDirection: writingDirection(language),
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function PeriodSelector({ options, selected, onChange, language }: PeriodSelectorProps) {
  return (
    <View style={[styles.wrap, rowStyle(language)]}>
      {options.map((option) => (
        <PeriodFilterButton
          key={option.key}
          label={option.label}
          value={option.key}
          selected={option.key === selected}
          onPress={() => onChange(option.key)}
          language={language}
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
    minHeight: 40,
    flex: 1,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    overflow: 'hidden',
  },
  label: {
    ...typography.body,
    fontWeight: '800',
  },
});
