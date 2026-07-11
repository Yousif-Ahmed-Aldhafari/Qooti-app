import type { TextInputProps } from 'react-native';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';

type FormInputProps = TextInputProps & {
  label: string;
};

export function FormInput({ label, style, ...props }: FormInputProps) {
  const theme = useAppTheme();
  const { contentDirectionStyle, direction, textAlign, textDirectionStyle, writingDirection } = useLanguage();

  return (
    <View style={[styles.wrapper, contentDirectionStyle]}>
      <Text style={[styles.label, textDirectionStyle, { color: theme.colors.text }]}>
        {label}
      </Text>
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
    gap: 7,
  },
  label: {
    alignSelf: 'stretch',
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
});
