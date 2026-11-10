import { I18nManager } from 'react-native';
import type { TextStyle, ViewStyle } from 'react-native';
import type { Language, TabKey } from '../types';

let activeLanguage: Language = 'en';

export function isRTL(language?: Language): boolean {
  const lang = language ?? activeLanguage;
  return lang === 'ar';
}

export function shouldReverseLayout(language?: Language): boolean {
  const lang = language ?? activeLanguage;
  return isRTL(lang) !== I18nManager.isRTL;
}

export function applyRTL(language: Language): boolean {
  activeLanguage = language;
  // Per Task 10B/10C requirements: Do NOT invoke I18nManager.forceRTL() or allowRTL()
  // during normal in-app language switching. Direction is handled dynamically via React styles.
  return false;
}

export function direction(language?: Language): ViewStyle['direction'] {
  const lang = language ?? activeLanguage;
  return isRTL(lang) ? 'rtl' : 'ltr';
}

export function textAlign(language?: Language): TextStyle['textAlign'] {
  const lang = language ?? activeLanguage;
  return isRTL(lang) ? ('right' as const) : ('left' as const);
}

export function writingDirection(language?: Language): TextStyle['writingDirection'] {
  const lang = language ?? activeLanguage;
  return isRTL(lang) ? 'rtl' : 'ltr';
}

export function rowDirection(language?: Language): ViewStyle['flexDirection'] {
  const lang = language ?? activeLanguage;
  return shouldReverseLayout(lang) ? 'row-reverse' : 'row';
}

/**
 * CANONICAL RTL RULE (Task 10C):
 * Do NOT include direction: 'rtl' together with row-reverse in rowStyle.
 * In React Native / Yoga, combining direction: 'rtl' with flexDirection: 'row-reverse'
 * causes double mirroring back to LTR.
 * We use pure deterministic flexDirection for rows.
 */
export function rowStyle(language?: Language): ViewStyle {
  const lang = language ?? activeLanguage;
  return {
    flexDirection: rowDirection(lang),
  };
}

export function flexStart(language?: Language): ViewStyle['alignSelf'] {
  const lang = language ?? activeLanguage;
  return shouldReverseLayout(lang) ? 'flex-end' : 'flex-start';
}

export function flexEnd(language?: Language): ViewStyle['alignSelf'] {
  const lang = language ?? activeLanguage;
  return shouldReverseLayout(lang) ? 'flex-start' : 'flex-end';
}

export function alignItemsStart(language?: Language): ViewStyle['alignItems'] {
  const lang = language ?? activeLanguage;
  return shouldReverseLayout(lang) ? 'flex-end' : 'flex-start';
}

export function alignItemsEnd(language?: Language): ViewStyle['alignItems'] {
  const lang = language ?? activeLanguage;
  return shouldReverseLayout(lang) ? 'flex-start' : 'flex-end';
}

export function getTabOrder(language?: Language): TabKey[] {
  const lang = language ?? activeLanguage;
  return isRTL(lang)
    ? ['profile', 'progress', 'workouts', 'meals', 'home']
    : ['home', 'meals', 'workouts', 'progress', 'profile'];
}

export const getDirection = direction;
export const getTextAlign = textAlign;
export const getWritingDirection = writingDirection;
export const getRowDirection = rowDirection;
export const getRowStyle = rowStyle;
export const getFlexStart = flexStart;
export const getFlexEnd = flexEnd;
export const getAlignItems = alignItemsStart;
export const getOppositeAlignItems = alignItemsEnd;

export function setActiveLanguage(language: Language) {
  activeLanguage = language;
}

export function getActiveLanguage(): Language {
  return activeLanguage;
}

export function activeIsRTL(): boolean {
  return isRTL(activeLanguage);
}

export function activeDirection() {
  return direction(activeLanguage);
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

export function activeRowStyle() {
  return rowStyle(activeLanguage);
}

export function activeFlexStart() {
  return flexStart(activeLanguage);
}

export function activeFlexEnd() {
  return flexEnd(activeLanguage);
}

