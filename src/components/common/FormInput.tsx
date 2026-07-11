import type { TextInputProps } from 'react-native';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';

type FormInputProps = TextInputProps & {
  label: string;
};

export function FormInput({ label, style, ...props }: FormInputProps) {
  const theme = useAppTheme();
  const { textAlign, writingDirection } = useLanguage();

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: theme.colors.text, textAlign, writingDirection }]}>
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
    gap: 7,
  },
  label: {
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
