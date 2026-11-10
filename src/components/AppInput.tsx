import { useState } from 'react';
import type { StyleProp, TextInputProps, ViewStyle } from 'react-native';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { activeTextAlign, activeWritingDirection } from '../utils/rtl';

type AppInputProps = TextInputProps & {
  label: string;
  error?: string;
  helperText?: string;
  disabled?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
};

export function AppInput({
  label,
  error,
  helperText,
  disabled = false,
  style,
  containerStyle,
  onFocus,
  onBlur,
  editable,
  ...props
}: AppInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const colors = themeColors();
  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  const isEditable = editable !== undefined ? editable && !disabled : !disabled;

  const handleFocus: TextInputProps['onFocus'] = (e) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur: TextInputProps['onBlur'] = (e) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  // Border color priority: Error -> Focused -> Default
  const borderColor = error
    ? colors.danger || colors.red || '#FF4D4D'
    : isFocused
      ? colors.accent
      : colors.border;

  return (
    <View style={[styles.wrap, containerStyle]}>
      <Text
        style={[
          styles.label,
          directionalText,
          { color: error ? (colors.danger || '#FF4D4D') : colors.textSecondary },
          disabled && styles.disabledText,
        ]}
      >
        {label}
      </Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={props.accessibilityLabel ?? label}
        accessibilityState={{ disabled: !isEditable }}
        editable={isEditable}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
        style={[
          styles.input,
          directionalText,
          {
            backgroundColor: !isEditable ? colors.cardMuted : colors.inputBackground,
            borderColor,
            borderWidth: isFocused || error ? 1.5 : 1,
            color: !isEditable ? colors.textMuted : colors.text,
          },
          props.multiline ? styles.multiline : null,
          style,
        ]}
      />
      {error ? (
        <Text
          accessibilityRole="alert"
          style={[styles.helper, directionalText, { color: colors.danger || colors.red || '#FF4D4D' }]}
        >
          {error}
        </Text>
      ) : helperText ? (
        <Text style={[styles.helper, directionalText, { color: colors.textMuted }]}>
          {helperText}
        </Text>
      ) : null}
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
  helper: {
    ...typography.caption,
    fontSize: 12,
    marginTop: -2,
  },
  disabledText: {
    opacity: 0.6,
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
