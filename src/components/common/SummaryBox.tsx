import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';

type IconName = keyof typeof Ionicons.glyphMap;

type SummaryBoxProps = {
  label: string;
  value: string | number;
  helper?: string;
  icon?: IconName;
  tone?: 'primary' | 'secondary' | 'success' | 'warning';
};

export function SummaryBox({ label, value, helper, icon, tone = 'primary' }: SummaryBoxProps) {
  const theme = useAppTheme();
  const { textAlign, writingDirection } = useLanguage();
  const toneColor = {
    primary: theme.colors.primary,
    secondary: theme.colors.secondary,
    success: theme.colors.success,
    warning: theme.colors.warning,
  }[tone];

  return (
    <View style={[styles.box, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      {icon ? <Ionicons name={icon} size={20} color={toneColor} /> : null}
      <Text style={[styles.value, { color: theme.colors.text, textAlign, writingDirection }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.label, { color: theme.colors.textMuted, textAlign, writingDirection }]} numberOfLines={2}>
        {label}
      </Text>
      {helper ? (
        <Text style={[styles.helper, { color: toneColor, textAlign, writingDirection }]} numberOfLines={1}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    minWidth: 132,
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    gap: 7,
  },
  value: {
    fontSize: 24,
    fontWeight: '900',
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
  },
  helper: {
    fontSize: 12,
    fontWeight: '700',
  },
});
