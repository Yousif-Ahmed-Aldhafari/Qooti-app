import type { TextStyle, ViewStyle } from 'react-native';

import { isRTLLanguage } from '../i18n';
import { useApp } from '../store/AppContext';

export function useLanguage() {
  const { settings, setLanguage, t } = useApp();
  const isRTL = isRTLLanguage(settings.selectedLanguage);

  return {
    language: settings.selectedLanguage,
    setLanguage,
    t,
    isRTL,
    direction: (isRTL ? 'rtl' : 'ltr') as ViewStyle['direction'],
    textAlign: (isRTL ? 'right' : 'left') as TextStyle['textAlign'],
    writingDirection: (isRTL ? 'rtl' : 'ltr') as TextStyle['writingDirection'],
    rowDirection: (isRTL ? 'row-reverse' : 'row') as ViewStyle['flexDirection'],
  };
}
