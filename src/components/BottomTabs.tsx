import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { TabKey } from '../types';
import { themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { activeRowDirection, activeWritingDirection } from '../utils/rtl';

type BottomTabsProps = {
  activeTab: TabKey;
  labels: Record<TabKey, string>;
  onChange: (tab: TabKey) => void;
};

const icons: Record<TabKey, keyof typeof Ionicons.glyphMap> = {
  home: 'home-outline',
  meals: 'restaurant-outline',
  workouts: 'barbell-outline',
  progress: 'analytics-outline',
  profile: 'person-outline',
};

const tabs: TabKey[] = ['home', 'meals', 'workouts', 'progress', 'profile'];

export function BottomTabs({ activeTab, labels, onChange }: BottomTabsProps) {
  const colors = themeColors();
  return (
    <View style={[styles.wrap, { flexDirection: activeRowDirection(), backgroundColor: colors.tabBar, borderColor: colors.border, shadowColor: colors.shadow }]}>
      {tabs.map((tab) => {
        const active = tab === activeTab;
        return (
          <Pressable key={tab} accessibilityRole="tab" onPress={() => onChange(tab)} style={styles.tab}>
            <View style={[styles.iconWrap, active ? { backgroundColor: colors.accent } : null]}>
              <Ionicons name={icons[tab]} size={20} color={active ? colors.buttonText : colors.textMuted} />
            </View>
            <Text
              style={[
                styles.label,
                { color: active ? colors.accent : colors.textMuted, writingDirection: activeWritingDirection() },
              ]}
              numberOfLines={1}
            >
              {labels[tab]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    start: 0,
    end: 0,
    bottom: 0,
    height: 96,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  iconWrap: {
    width: 34,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.tab,
  },
});
