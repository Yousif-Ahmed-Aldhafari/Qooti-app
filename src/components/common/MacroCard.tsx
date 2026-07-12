import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';
import { macroProgress } from '../../utils/health';

type MacroCardProps = {
  label: string;
  value: number;
  goal: number;
  unit: string;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
};

export function MacroCard({ label, value, goal, unit, icon, color }: MacroCardProps) {
  const theme = useAppTheme();
  const { rowDirectionStyle, textDirectionStyle } = useLanguage();
  const progress = macroProgress(value, goal);
  const tone = color ?? theme.colors.primary;

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <View style={[styles.top, rowDirectionStyle]}>
        <View style={[styles.icon, { backgroundColor: theme.colors.primaryMuted }]}>
          <Ionicons name={icon} color={tone} size={18} />
        </View>
        <Text style={[styles.value, textDirectionStyle, { color: theme.colors.text }]}>
          {Math.round(value)}
          <Text style={[styles.unit, { color: theme.colors.textMuted }]}> {unit}</Text>
        </Text>
      </View>
      <Text style={[styles.label, textDirectionStyle, { color: theme.colors.textMuted }]}>{label}</Text>
      <View style={[styles.track, { backgroundColor: theme.colors.surfaceMuted }]}>
        <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: tone }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 142,
    borderRadius: 22,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  top: {
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    flex: 1,
    fontSize: 20,
    fontWeight: '900',
  },
  unit: {
    fontSize: 11,
    fontWeight: '800',
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
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
