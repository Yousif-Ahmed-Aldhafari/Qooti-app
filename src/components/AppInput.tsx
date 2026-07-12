import type { TextInputProps } from 'react-native';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { activeTextAlign, activeWritingDirection } from '../utils/rtl';

type AppInputProps = TextInputProps & {
  label: string;
};

export function AppInput({ label, style, ...props }: AppInputProps) {
  const colors = themeColors();
  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, directionalText, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        {...props}
        style={[
          styles.input,
          directionalText,
          { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text },
          props.multiline ? styles.multiline : null,
          style,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  label: {
    ...typography.caption,
  },
  input: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.body,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
});
