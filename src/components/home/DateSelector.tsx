import { Pressable, StyleSheet, Text, View } from 'react-native';

import { themeColors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { activeRowDirection, activeWritingDirection } from '../../utils/rtl';

export type DateOption = {
  key: string;
  dayName: string;
  dayNumber: string;
};

type DateSelectorProps = {
  title: string;
  dates: DateOption[];
  selectedDate: string;
  onSelect: (date: string) => void;
};

export function DateSelector({ title, dates, selectedDate, onSelect }: DateSelectorProps) {
  const colors = themeColors();
  const writingDirection = activeWritingDirection();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: colors.text, writingDirection }]}>{title}</Text>
      <View style={[styles.row, { flexDirection: activeRowDirection() }]}>
        {dates.map((date) => {
          const selected = date.key === selectedDate;

          return (
            <Pressable key={date.key} accessibilityRole="button" onPress={() => onSelect(date.key)} style={styles.day}>
              <Text style={[styles.dayName, { color: selected ? colors.text : colors.textMuted, writingDirection }]}>{date.dayName}</Text>
              <View
                style={[
                  styles.dayCircle,
                  { borderColor: colors.text, backgroundColor: selected ? colors.text : colors.background },
                ]}
              >
                <Text style={[styles.dayNumber, { color: selected ? colors.background : colors.text, writingDirection }]}>{date.dayNumber}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  title: {
    ...typography.h3,
    textAlign: 'center',
  },
  row: {
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  day: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
  },
  dayName: {
    ...typography.caption,
  },
  dayCircle: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  dayNumber: {
    ...typography.body,
    fontWeight: '900',
  },
});
