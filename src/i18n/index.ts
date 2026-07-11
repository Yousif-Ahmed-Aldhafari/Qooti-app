import ar from './ar.json';
import en from './en.json';
import type { Language } from '../models/settings';

type Dictionary = Record<string, unknown>;

const dictionaries: Record<Language, Dictionary> = {
  en,
  ar,
};

export const supportedLanguages: Language[] = ['en', 'ar'];

export function isRTLLanguage(language: Language): boolean {
  return language === 'ar';
}

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
  const fallback = readPath(dictionaries.en, key) ?? key;
  const template = readPath(dictionaries[language], key) ?? fallback;

  if (!values) {
    return template;
  }

  return template.replace(/\{\{(\w+)\}\}/g, (_, token: string) =>
    String(values[token] ?? ''),
  );
}
