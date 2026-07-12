import { StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppHeader } from '../../components/common/AppHeader';
import { LanguageSwitcher } from '../../components/common/LanguageSwitcher';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { SegmentedControl } from '../../components/common/SegmentedControl';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';
import type { MeasurementUnits, ThemeMode } from '../../models/settings';
import type { RootStackParamList } from '../../navigation/types';
import { useApp } from '../../store/AppContext';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function SettingsScreen() {
  const navigation = useNavigation<Navigation>();
  const { settings, setLanguage, updateSettings } = useApp();
  const theme = useAppTheme();
  const { t, textDirectionStyle } = useLanguage();

  return (
    <ScreenContainer>
      <AppHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <AppCard>
        <Text style={[styles.sectionTitle, textDirectionStyle, { color: theme.colors.text }]}>
          {t('settings.language')}
        </Text>
        <LanguageSwitcher value={settings.selectedLanguage} onChange={setLanguage} />
        <AppButton
          title={t('settings.changeLanguage')}
          icon="language-outline"
          variant="ghost"
          onPress={() => navigation.navigate('Language', { fromSettings: true })}
        />
      </AppCard>

      <AppCard>
        <Text style={[styles.sectionTitle, textDirectionStyle, { color: theme.colors.text }]}>
          {t('settings.theme')}
        </Text>
        <SegmentedControl<ThemeMode>
          value={settings.themeMode}
          onChange={(themeMode) => updateSettings({ themeMode })}
          options={[
            { value: 'system', label: t('settings.themeSystem') },
            { value: 'light', label: t('settings.themeLight') },
            { value: 'dark', label: t('settings.themeDark') },
          ]}
        />
      </AppCard>

      <AppCard>
        <Text style={[styles.sectionTitle, textDirectionStyle, { color: theme.colors.text }]}>
          {t('settings.units')}
        </Text>
        <SegmentedControl<MeasurementUnits>
          value={settings.measurementUnits}
          onChange={(measurementUnits) => updateSettings({ measurementUnits })}
          options={[
            { value: 'metric', label: t('settings.metric') },
            { value: 'imperial', label: t('settings.imperial') },
          ]}
        />
      </AppCard>

      <AppCard>
        <Text style={[styles.sectionTitle, textDirectionStyle, { color: theme.colors.text }]}>
          {t('settings.about')}
        </Text>
        <Text style={[styles.body, textDirectionStyle, { color: theme.colors.textMuted }]}>
          {t('settings.aboutBody')}
        </Text>
      </AppCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '700',
  },
});
