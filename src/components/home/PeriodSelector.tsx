import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { activeRowDirection } from '../../utils/rtl';

export type PeriodKey = 'today' | 'week' | 'month';

type PeriodOption = {
  key: PeriodKey;
  label: string;
  accent: string;
};

type PeriodSelectorProps = {
  options: PeriodOption[];
  selected: PeriodKey;
  onChange: (period: PeriodKey) => void;
};

export function PeriodSelector({ options, selected, onChange }: PeriodSelectorProps) {
  return (
    <View style={[styles.wrap, { flexDirection: activeRowDirection() }]}>
      {options.map((option) => {
        const active = option.key === selected;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            onPress={() => onChange(option.key)}
            style={({ pressed }) => [
              styles.pill,
              { backgroundColor: active ? colors.accent : option.accent, opacity: pressed ? 0.78 : 1 },
            ]}
          >
            <Text style={[styles.label, { color: active ? colors.black : colors.text }]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  label: {
    ...typography.body,
    fontWeight: '800',
  },
});
