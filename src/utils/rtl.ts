import { I18nManager } from 'react-native';
import type { TextStyle, ViewStyle } from 'react-native';
import type { Language } from '../types';

let activeLanguage: Language = 'en';

export function isRTL(language: Language): boolean {
  return language === 'ar';
}

export function applyRTL(language: Language): boolean {
  activeLanguage = language;
  const shouldUseRTL = isRTL(language);
  const restartRequired = I18nManager.isRTL !== shouldUseRTL;

  I18nManager.allowRTL(shouldUseRTL);
  I18nManager.forceRTL(shouldUseRTL);
  I18nManager.swapLeftAndRightInRTL(shouldUseRTL);

  return restartRequired;
}

export function direction(language: Language): ViewStyle['direction'] {
  return isRTL(language) ? 'rtl' : 'ltr';
}

export function textAlign(language: Language): TextStyle['textAlign'] {
  return isRTL(language) ? 'right' as const : 'left' as const;
}

export function writingDirection(language: Language): TextStyle['writingDirection'] {
  return isRTL(language) ? 'rtl' : 'ltr';
}

export function rowDirection(language: Language): ViewStyle['flexDirection'] {
  return isRTL(language) ? 'row-reverse' as const : 'row' as const;
}

export function flexStart(language: Language): ViewStyle['alignSelf'] {
  return isRTL(language) ? 'flex-end' as const : 'flex-start' as const;
}

export function flexEnd(language: Language): ViewStyle['alignSelf'] {
  return isRTL(language) ? 'flex-start' as const : 'flex-end' as const;
}

export const getDirection = direction;
export const getTextAlign = textAlign;
export const getWritingDirection = writingDirection;
export const getRowDirection = rowDirection;
export const getFlexStart = flexStart;
export const getFlexEnd = flexEnd;

export function activeIsRTL(): boolean {
  return isRTL(activeLanguage);
}

export function activeTextAlign() {
  return textAlign(activeLanguage);
}

export function activeWritingDirection() {
  return writingDirection(activeLanguage);
}

export function activeRowDirection() {
  return rowDirection(activeLanguage);
}

export function activeFlexStart() {
  return flexStart(activeLanguage);
}

export function activeFlexEnd() {
  return flexEnd(activeLanguage);
}
