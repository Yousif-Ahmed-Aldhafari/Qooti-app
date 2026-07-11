import { StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppButton } from '../../components/common/AppButton';
import { Card } from '../../components/common/Card';
import { LanguageSwitcher } from '../../components/common/LanguageSwitcher';
import { Screen } from '../../components/common/Screen';
import { SectionHeader } from '../../components/common/SectionHeader';
import { SegmentedControl } from '../../components/common/SegmentedControl';
import { useApp } from '../../store/AppContext';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';
import type { MeasurementUnits, ThemeMode } from '../../models/settings';
import type { RootStackParamList } from '../../navigation/types';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function SettingsScreen() {
  const navigation = useNavigation<Navigation>();
  const { settings, setLanguage, updateSettings } = useApp();
  const theme = useAppTheme();
  const { t, textDirectionStyle } = useLanguage();

  return (
    <Screen>
      <SectionHeader title={t('settings.title')} />

      <Card>
        <SectionHeader title={t('settings.language')} />
        <LanguageSwitcher value={settings.selectedLanguage} onChange={setLanguage} />
        <AppButton
          title={t('settings.changeLanguage')}
          icon="language-outline"
          variant="ghost"
          onPress={() => navigation.navigate('Language', { fromSettings: true })}
        />
      </Card>

      <Card>
        <SectionHeader title={t('settings.theme')} />
        <SegmentedControl<ThemeMode>
          value={settings.themeMode}
          onChange={(themeMode) => updateSettings({ themeMode })}
          options={[
            { value: 'system', label: t('settings.themeSystem') },
            { value: 'light', label: t('settings.themeLight') },
            { value: 'dark', label: t('settings.themeDark') },
          ]}
        />
      </Card>

      <Card>
        <SectionHeader title={t('settings.units')} />
        <SegmentedControl<MeasurementUnits>
          value={settings.measurementUnits}
          onChange={(measurementUnits) => updateSettings({ measurementUnits })}
          options={[
            { value: 'metric', label: t('settings.metric') },
            { value: 'imperial', label: t('settings.imperial') },
          ]}
        />
      </Card>

      <Card>
        <SectionHeader title={t('settings.about')} />
        <Text style={[styles.body, textDirectionStyle, { color: theme.colors.textMuted }]}>
          {t('settings.aboutBody')}
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    fontSize: 14,
    lineHeight: 22,
  },
});
