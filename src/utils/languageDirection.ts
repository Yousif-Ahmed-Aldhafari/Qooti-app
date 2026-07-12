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
  return 'row';
}

export function getRowStyle(language: Language): ViewStyle {
  return {
    direction: getDirection(language),
    flexDirection: getRowDirection(language),
  };
}

export function getFlexStart(language: Language): ViewStyle['alignSelf'] {
  return 'flex-start';
}

export function getFlexEnd(language: Language): ViewStyle['alignSelf'] {
  return 'flex-end';
}

export function getAlignItems(language: Language): ViewStyle['alignItems'] {
  return 'flex-start';
}

export function getOppositeAlignItems(language: Language): ViewStyle['alignItems'] {
  return 'flex-end';
}

export function applyAppDirection(language: Language): boolean {
  const shouldUseRTL = isRTLLanguage(language);
  const restartRequired = I18nManager.isRTL !== shouldUseRTL;

  I18nManager.allowRTL(shouldUseRTL);
  I18nManager.forceRTL(shouldUseRTL);
  I18nManager.swapLeftAndRightInRTL(shouldUseRTL);

  return restartRequired;
}
