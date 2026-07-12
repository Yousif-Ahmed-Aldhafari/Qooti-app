import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { activeRowDirection } from '../../utils/rtl';

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
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <View style={[styles.row, { flexDirection: activeRowDirection() }]}>
        {dates.map((date) => {
          const selected = date.key === selectedDate;

          return (
            <Pressable key={date.key} accessibilityRole="button" onPress={() => onSelect(date.key)} style={styles.day}>
              <Text style={[styles.dayName, selected ? styles.selectedDayName : null]}>{date.dayName}</Text>
              <View style={[styles.dayCircle, selected ? styles.selectedCircle : null]}>
                <Text style={[styles.dayNumber, selected ? styles.selectedDayNumber : null]}>{date.dayNumber}</Text>
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
    color: colors.text,
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
    color: colors.textMuted,
  },
  selectedDayName: {
    color: colors.text,
  },
  dayCircle: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.text,
    backgroundColor: colors.background,
  },
  selectedCircle: {
    borderColor: colors.text,
    backgroundColor: colors.text,
  },
  dayNumber: {
    ...typography.body,
    fontWeight: '900',
    color: colors.text,
  },
  selectedDayNumber: {
    color: colors.black,
  },
});
