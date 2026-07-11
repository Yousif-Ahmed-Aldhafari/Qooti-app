import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { AppButton } from '../../components/common/AppButton';
import { Card } from '../../components/common/Card';
import { LanguageSwitcher } from '../../components/common/LanguageSwitcher';
import { Screen } from '../../components/common/Screen';
import { useApp } from '../../store/AppContext';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';
import type { Language } from '../../models/settings';
import type { RootStackParamList } from '../../navigation/types';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Language'>;
type LanguageRoute = RouteProp<RootStackParamList, 'Language'>;

export function LanguageSelectionScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<LanguageRoute>();
  const { settings, setLanguage, completeOnboarding } = useApp();
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(settings.selectedLanguage);
  const theme = useAppTheme();
  const { t, textDirectionStyle } = useLanguage();
  const fromSettings = route.params?.fromSettings;

  function handleLanguageChange(language: Language) {
    setSelectedLanguage(language);

    if (language !== settings.selectedLanguage) {
      setLanguage(language);
    }
  }

  function handleDone() {
    if (fromSettings) {
      navigation.goBack();
      return;
    }

    completeOnboarding();
  }

  return (
    <Screen contentStyle={styles.content}>
      <Card>
        <Text style={[styles.title, textDirectionStyle, { color: theme.colors.text }]}>
          {t('language.title')}
        </Text>
        <Text style={[styles.subtitle, textDirectionStyle, { color: theme.colors.textMuted }]}>
          {t('language.subtitle')}
        </Text>
        <LanguageSwitcher value={selectedLanguage} onChange={handleLanguageChange} />
      </Card>

      <AppButton
        title={fromSettings ? t('common.done') : t('common.continue')}
        icon="checkmark"
        onPress={handleDone}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
  },
});
