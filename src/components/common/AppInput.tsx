import type { TextInputProps } from 'react-native';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';

type AppInputProps = TextInputProps & {
  label: string;
};

export function AppInput({ label, style, ...props }: AppInputProps) {
  const theme = useAppTheme();
  const { contentDirectionStyle, direction, textAlign, textDirectionStyle, writingDirection } = useLanguage();

  return (
    <View style={[styles.wrapper, contentDirectionStyle]}>
      <Text style={[styles.label, textDirectionStyle, { color: theme.colors.text }]}>{label}</Text>
      <TextInput
        placeholderTextColor={theme.colors.textMuted}
        {...props}
        style={[
          styles.input,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            color: theme.colors.text,
            direction,
            textAlign,
            writingDirection,
          },
          props.multiline ? styles.multiline : null,
          style,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'stretch',
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
  },
  input: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600',
  },
  multiline: {
    minHeight: 108,
    textAlignVertical: 'top',
  },
});
