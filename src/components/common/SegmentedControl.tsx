import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';

type Option<T extends string> = {
  label: string;
  value: T;
};

type SegmentedControlProps<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  const theme = useAppTheme();
  const { rowDirectionStyle, textDirectionStyle } = useLanguage();

  return (
    <View
      style={[
        styles.wrapper,
        rowDirectionStyle,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: theme.colors.border,
        },
      ]}
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <Pressable
            accessibilityRole="button"
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[
              styles.option,
              {
                backgroundColor: selected ? theme.colors.surface : 'transparent',
              },
            ]}
          >
            <Text
              style={[
                styles.label,
                {
                  color: selected ? theme.colors.primary : theme.colors.textMuted,
                },
                textDirectionStyle,
              ]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  option: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    paddingHorizontal: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
  },
});
