import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { themeColors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { activeIsRTL, activeRowStyle, activeTextAlign, activeWritingDirection } from '../../utils/rtl';

export type HomeActivity = {
  id: string;
  title: string;
  time: string;
  meta: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  onPress: () => void;
};

type LatestActivityListProps = {
  title: string;
  emptyTitle: string;
  activities: HomeActivity[];
};

export function LatestActivityList({ title, emptyTitle, activities }: LatestActivityListProps) {
  const colors = themeColors();
  const rtl = activeIsRTL();
  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  return (
    <View style={styles.wrap}>
      <View style={[styles.headingRow, activeRowStyle()]}>
        <Text style={[styles.heading, directionalText, { color: colors.text }]}>{title}</Text>
        <View style={[styles.headingAction, { borderColor: colors.text }]}>
          <Ionicons name={rtl ? 'arrow-back' : 'arrow-forward'} size={20} color={colors.orange} />
        </View>
      </View>

      {activities.length ? (
        activities.map((activity) => (
          <Pressable
            key={activity.id}
            accessibilityRole="button"
            onPress={activity.onPress}
            style={({ pressed }) => [
              styles.activity,
              activeRowStyle(),
              { backgroundColor: colors.card, opacity: pressed ? 0.76 : 1 },
            ]}
          >
            <View style={[styles.icon, { backgroundColor: activity.accent }]}>
              <Ionicons name={activity.icon} size={20} color={colors.black} />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.activityTitle, directionalText, { color: colors.text }]} numberOfLines={1}>
                {activity.title}
              </Text>
              <Text style={[styles.activityMeta, directionalText, { color: colors.textMuted }]} numberOfLines={1}>
                {activity.time} - {activity.meta}
              </Text>
            </View>
            <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={20} color={colors.textMuted} />
          </Pressable>
        ))
      ) : (
        <View style={[styles.empty, { backgroundColor: colors.card }]}>
          <Text style={[styles.emptyText, directionalText, { color: colors.textMuted }]}>{emptyTitle}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  headingRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: {
    ...typography.h3,
  },
  headingAction: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  activity: {
    minHeight: 76,
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
  activityTitle: {
    ...typography.body,
    fontWeight: '800',
  },
  activityMeta: {
    ...typography.caption,
  },
  empty: {
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  emptyText: {
    ...typography.body,
  },
});
