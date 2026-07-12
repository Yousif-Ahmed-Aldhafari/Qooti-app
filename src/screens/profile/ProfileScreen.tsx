import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppHeader } from '../../components/common/AppHeader';
import { MacroCard } from '../../components/common/MacroCard';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';
import type { RootStackParamList } from '../../navigation/types';
import { useApp } from '../../store/AppContext';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function ProfileScreen() {
  const navigation = useNavigation<Navigation>();
  const { logout, profile } = useApp();
  const theme = useAppTheme();
  const { rowDirectionStyle, t, textDirectionStyle } = useLanguage();

  return (
    <ScreenContainer>
      <AppHeader title={t('profile.title')} subtitle={t('profile.subtitle')} />

      <AppCard tone="primary">
        <View style={[styles.profileRow, rowDirectionStyle]}>
          <View style={styles.avatar}>
            <Ionicons name="person" color={theme.colors.primary} size={34} />
          </View>
          <View style={styles.profileCopy}>
            <Text style={[styles.name, textDirectionStyle]}>{profile.name}</Text>
            <Text style={[styles.email, textDirectionStyle]}>{profile.email}</Text>
          </View>
        </View>
        <Text style={[styles.goal, textDirectionStyle]}>{profile.goal}</Text>
      </AppCard>

      <View style={[styles.grid, rowDirectionStyle]}>
        <AppCard style={styles.statCard}>
          <Text style={[styles.statValue, textDirectionStyle, { color: theme.colors.text }]}>{profile.heightCm}</Text>
          <Text style={[styles.statLabel, textDirectionStyle, { color: theme.colors.textMuted }]}>
            {t('common.cm')} · {t('profile.height')}
          </Text>
        </AppCard>
        <AppCard style={styles.statCard}>
          <Text style={[styles.statValue, textDirectionStyle, { color: theme.colors.text }]}>{profile.weightKg}</Text>
          <Text style={[styles.statLabel, textDirectionStyle, { color: theme.colors.textMuted }]}>
            {t('workouts.kg')} · {t('profile.weight')}
          </Text>
        </AppCard>
      </View>

      <Text style={[styles.sectionTitle, textDirectionStyle, { color: theme.colors.text }]}>
        {t('profile.targets')}
      </Text>
      <View style={[styles.grid, rowDirectionStyle]}>
        <MacroCard label={t('macros.calories')} value={profile.targetCalories} goal={profile.targetCalories} unit={t('macros.kcal')} icon="flame-outline" color={theme.colors.warning} />
        <MacroCard label={t('macros.protein')} value={profile.targetProtein} goal={profile.targetProtein} unit={t('macros.grams')} icon="barbell-outline" />
      </View>

      <AppCard>
        <AppButton title={t('profile.settings')} icon="settings-outline" variant="secondary" onPress={() => navigation.navigate('Settings')} />
        <AppButton title={t('profile.logout')} icon="log-out-outline" variant="ghost" onPress={logout} />
      </AppCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  profileRow: {
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  profileCopy: {
    flex: 1,
  },
  name: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '900',
  },
  email: {
    color: '#EAF3FF',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
  goal: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 21,
  },
  grid: {
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: 140,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '900',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
});
