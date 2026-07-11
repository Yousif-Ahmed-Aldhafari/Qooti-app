import { I18nManager } from 'react-native';
import type { TextStyle, ViewStyle } from 'react-native';

import type { Language } from '../models/settings';

export function isRTLLanguage(language: Language): boolean {
  return language === 'ar';
}

export function getDirection(language: Language): ViewStyle['direction'] {
  return isRTLLanguage(language) ? 'rtl' : 'ltr';
}

export function getTextAlign(language: Language): TextStyle['textAlign'] {
  return 'left';
}

export function getWritingDirection(language: Language): TextStyle['writingDirection'] {
  return isRTLLanguage(language) ? 'rtl' : 'ltr';
}

export function getRowDirection(language: Language): ViewStyle['flexDirection'] {
  return 'row';
}

export function applyAppDirection(language: Language): void {
  const shouldUseRTL = isRTLLanguage(language);

  I18nManager.allowRTL(shouldUseRTL);
  I18nManager.forceRTL(shouldUseRTL);
  I18nManager.swapLeftAndRightInRTL(shouldUseRTL);
}
