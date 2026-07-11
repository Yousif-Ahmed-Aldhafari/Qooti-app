import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

import { AppButton } from '../../components/common/AppButton';
import { Card } from '../../components/common/Card';
import { Screen } from '../../components/common/Screen';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';
import type { RootStackParamList } from '../../navigation/types';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;

export function OnboardingScreen() {
  const navigation = useNavigation<Navigation>();
  const theme = useAppTheme();
  const { t, contentDirectionStyle, textDirectionStyle, rowDirectionStyle, writingDirection } = useLanguage();
  const points = [
    { icon: 'restaurant-outline' as const, label: t('onboarding.mealPoint') },
    { icon: 'analytics-outline' as const, label: t('onboarding.macroPoint') },
    { icon: 'barbell-outline' as const, label: t('onboarding.workoutPoint') },
    { icon: 'phone-portrait-outline' as const, label: t('onboarding.privacyPoint') },
  ];

  return (
    <Screen contentStyle={styles.content}>
      <View style={[styles.hero, contentDirectionStyle]}>
        <View style={[styles.logo, { backgroundColor: theme.colors.primaryMuted }]}>
          <Text style={[styles.logoText, { color: theme.colors.primary, writingDirection }]}>
            {t('app.arabicName')}
          </Text>
        </View>
        <Text style={[styles.appName, textDirectionStyle, { color: theme.colors.text }]}>
          {t('app.name')}
        </Text>
        <Text style={[styles.tagline, textDirectionStyle, { color: theme.colors.textMuted }]}>
          {t('app.tagline')}
        </Text>
      </View>

      <Card>
        <Text style={[styles.title, textDirectionStyle, { color: theme.colors.text }]}>
          {t('onboarding.title')}
        </Text>
        <Text style={[styles.body, textDirectionStyle, { color: theme.colors.textMuted }]}>
          {t('onboarding.body')}
        </Text>
        <View style={styles.points}>
          {points.map((point) => (
            <View key={point.label} style={[styles.point, rowDirectionStyle]}>
              <Ionicons name={point.icon} color={theme.colors.primary} size={21} />
              <Text style={[styles.pointText, textDirectionStyle, { color: theme.colors.text }]}>
                {point.label}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <AppButton title={t('common.continue')} icon="arrow-forward" onPress={() => navigation.navigate('Language')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  hero: {
    alignSelf: 'stretch',
    gap: 10,
    paddingVertical: 12,
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 24,
    fontWeight: '900',
  },
  appName: {
    fontSize: 34,
    fontWeight: '900',
  },
  tagline: {
    fontSize: 15,
    lineHeight: 22,
  },
  title: {
    fontSize: 23,
    fontWeight: '900',
  },
  body: {
    fontSize: 15,
    lineHeight: 23,
  },
  points: {
    gap: 12,
  },
  point: {
    alignItems: 'center',
    gap: 10,
  },
  pointText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
});
