import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';

type ProgressCardProps = {
  label: string;
  value: string;
  helper: string;
  progress: number;
};

export function ProgressCard({ label, value, helper, progress }: ProgressCardProps) {
  const theme = useAppTheme();
  const { textDirectionStyle } = useLanguage();
  const clamped = Math.min(1, Math.max(0, progress));

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <Text style={[styles.label, textDirectionStyle, { color: theme.colors.textMuted }]}>{label}</Text>
      <Text style={[styles.value, textDirectionStyle, { color: theme.colors.text }]}>{value}</Text>
      <Text style={[styles.helper, textDirectionStyle, { color: theme.colors.textMuted }]}>{helper}</Text>
      <View style={[styles.track, { backgroundColor: theme.colors.surfaceMuted }]}>
        <View style={[styles.fill, { width: `${clamped * 100}%`, backgroundColor: theme.colors.secondary }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 150,
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
  },
  value: {
    fontSize: 25,
    fontWeight: '900',
  },
  helper: {
    fontSize: 12,
    fontWeight: '700',
  },
  track: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
});
