import { Pressable, StyleSheet, Text, View } from 'react-native';

import { themeColors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import type { Language } from '../../types';
import { rowStyle, writingDirection as getWritingDirection } from '../../utils/rtl';
import { calculateHitSlop, getPressFeedback } from '../../utils/touchFeedback';

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
  language?: Language;
};

export function DateSelector({ title, dates, selectedDate, onSelect, language }: DateSelectorProps) {
  const colors = themeColors();
  const writingDirection = getWritingDirection(language);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: colors.text, writingDirection }]}>{title}</Text>
      <View style={[styles.row, rowStyle(language)]}>
        {dates.map((date) => {
          const selected = date.key === selectedDate;
          const { android_ripple, styleModifier } = getPressFeedback({
            rippleColor: selected ? 'rgba(255, 255, 255, 0.25)' : `${colors.text}26`,
            borderless: true,
            activeOpacity: 0.72,
          });

          return (
            <Pressable
              key={date.key}
              accessibilityRole="button"
              accessibilityLabel={`${date.dayName}, ${date.dayNumber}`}
              accessibilityState={{ selected }}
              hitSlop={calculateHitSlop(40, 56)}
              android_ripple={android_ripple}
              onPress={() => onSelect(date.key)}
              style={({ pressed }) => [styles.day, styleModifier({ pressed })]}
            >
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
