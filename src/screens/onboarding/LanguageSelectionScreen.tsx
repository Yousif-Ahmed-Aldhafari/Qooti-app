import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppHeader } from '../../components/common/AppHeader';
import { LanguageSwitcher } from '../../components/common/LanguageSwitcher';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';
import type { Language } from '../../models/settings';
import type { RootStackParamList } from '../../navigation/types';
import { useApp } from '../../store/AppContext';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Language'>;
type LanguageRoute = RouteProp<RootStackParamList, 'Language'>;

export function LanguageSelectionScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<LanguageRoute>();
  const { completeOnboarding, settings, setLanguage } = useApp();
  const theme = useAppTheme();
  const { t, textDirectionStyle } = useLanguage();
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(settings.selectedLanguage);
  const fromSettings = route.params?.fromSettings;

  function handleLanguageChange(language: Language) {
    setSelectedLanguage(language);
    setLanguage(language);
  }

  function handleDone() {
    if (fromSettings) {
      navigation.goBack();
      return;
    }

    completeOnboarding();
  }

  return (
    <ScreenContainer contentStyle={styles.content}>
      <AppHeader title={t('language.title')} subtitle={t('language.subtitle')} />

      <AppCard>
        <Text style={[styles.label, textDirectionStyle, { color: theme.colors.textMuted }]}>
          {t('language.current')}
        </Text>
        <LanguageSwitcher value={selectedLanguage} onChange={handleLanguageChange} />
      </AppCard>

      <AppButton title={fromSettings ? t('common.done') : t('common.continue')} icon="checkmark" onPress={handleDone} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '900',
  },
});
