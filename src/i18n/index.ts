import type { Language } from '../types';
import { isRTL } from '../utils/rtl';
import { ar } from './ar';
import { en } from './en';

type Dictionary = Record<string, unknown>;

const dictionaries: Record<Language, Dictionary> = {
  en,
  ar,
};

export const supportedLanguages: Language[] = ['en', 'ar'];
export const isRTLLanguage = isRTL;

function readPath(dictionary: Dictionary, key: string): string | undefined {
  const value = key.split('.').reduce<unknown>((current, part) => {
    if (current && typeof current === 'object' && part in current) {
      return (current as Dictionary)[part];
    }

    return undefined;
  }, dictionary);

  return typeof value === 'string' ? value : undefined;
}

export function translate(
  language: Language,
  key: string,
  values?: Record<string, string | number>,
): string {
  const fallback = readPath(dictionaries.en, key);
  const localized = readPath(dictionaries[language], key);

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    if (!localized && !fallback) {
      console.warn(`[i18n] Missing translation key: "${key}" (requested lang: "${language}")`);
    } else if (!localized && language !== 'en') {
      console.info(`[i18n] Fallback to English for key: "${key}" (requested lang: "${language}")`);
    }
  }

  const template = localized ?? fallback ?? key;

  if (!values) {
    return template;
  }

  return template.replace(/\{\{(\w+)\}\}/g, (_, token: string) => String(values[token] ?? ''));
}

export type Translator = (key: string, values?: Record<string, string | number>) => string;
