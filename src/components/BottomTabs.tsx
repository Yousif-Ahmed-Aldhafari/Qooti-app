import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

import type { TabKey } from '../types';
import { getActiveTheme, themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { activeRowStyle, activeWritingDirection } from '../utils/rtl';

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
  const theme = getActiveTheme();

  return (
    <View
      style={[
        styles.wrap,
        activeRowStyle(),
        {
          backgroundColor: colors.glassTabBackground,
          borderColor: colors.glassBorder,
          shadowColor: colors.shadow,
        },
      ]}
    >
      <BlurView
        intensity={theme.isDark ? 36 : 54}
        tint={theme.isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      {tabs.map((tab) => {
        const active = tab === activeTab;
        return (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(tab)}
            style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.76 : 1 }]}
          >
            <View style={[styles.iconWrap, active ? { backgroundColor: colors.primary } : null]}>
              <Ionicons name={icons[tab]} size={20} color={active ? colors.white : colors.textMuted} />
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
    start: spacing.lg,
    end: spacing.lg,
    bottom: spacing.lg,
    height: 76,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.md,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 62,
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
    maxWidth: 74,
  },
});
