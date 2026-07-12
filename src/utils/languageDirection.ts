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
  return isRTLLanguage(language) ? 'right' : 'left';
}

export function getWritingDirection(language: Language): TextStyle['writingDirection'] {
  return isRTLLanguage(language) ? 'rtl' : 'ltr';
}

export function getRowDirection(language: Language): ViewStyle['flexDirection'] {
  return isRTLLanguage(language) ? 'row-reverse' : 'row';
}

export function getFlexStart(language: Language): ViewStyle['alignSelf'] {
  return isRTLLanguage(language) ? 'flex-end' : 'flex-start';
}

export function getFlexEnd(language: Language): ViewStyle['alignSelf'] {
  return isRTLLanguage(language) ? 'flex-start' : 'flex-end';
}

export function applyAppDirection(language: Language): boolean {
  const shouldUseRTL = isRTLLanguage(language);
  const restartRequired = I18nManager.isRTL !== shouldUseRTL;

  I18nManager.allowRTL(shouldUseRTL);
  I18nManager.forceRTL(shouldUseRTL);
  I18nManager.swapLeftAndRightInRTL(shouldUseRTL);

  return restartRequired;
}
