import { I18nManager } from 'react-native';
import type { Language } from '../types';

let activeLanguage: Language = I18nManager.isRTL ? 'ar' : 'en';

export function isRTL(language: Language): boolean {
  return language === 'ar';
}

export function applyRTL(language: Language): void {
  activeLanguage = language;
  const shouldUseRTL = isRTL(language);
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(shouldUseRTL);
  I18nManager.swapLeftAndRightInRTL(shouldUseRTL);
}

export function direction(language: Language) {
  return isRTL(language) ? 'rtl' : 'ltr';
}

export function textAlign(language: Language) {
  return isRTL(language) ? 'right' as const : 'left' as const;
}

export function writingDirection(language: Language) {
  return isRTL(language) ? 'rtl' : 'ltr';
}

export function rowDirection(language: Language) {
  return isRTL(language) ? 'row-reverse' as const : 'row' as const;
}

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
