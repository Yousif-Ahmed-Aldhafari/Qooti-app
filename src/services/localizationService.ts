import { Linking, Platform } from 'react-native';
import { getLocales } from 'expo-localization';
import type { Language } from '../types';

export const SUPPORTED_LANGUAGES: Language[] = ['en', 'ar'];
export const DEFAULT_FALLBACK_LANGUAGE: Language = 'en';

/**
 * Normalizes an arbitrary locale or language tag (e.g. "ar-SA", "en_US", "ar")
 * to one of Qooti's supported languages ('en' | 'ar'), or null if unsupported.
 */
export function normalizeLocaleToLanguage(localeTagOrCode?: string | null): Language | null {
  if (!localeTagOrCode || typeof localeTagOrCode !== 'string') {
    return null;
  }

  const normalized = localeTagOrCode.trim().toLowerCase().replace('_', '-');
  if (normalized === 'ar' || normalized.startsWith('ar-')) {
    return 'ar';
  }
  if (normalized === 'en' || normalized.startsWith('en-')) {
    return 'en';
  }

  return null;
}

/**
 * Reads the device's native locale list using expo-localization getLocales()
 * and resolves the first matching supported language.
 * Defaults to 'en' when no supported language is configured on the device.
 */
export function getNativeDeviceLanguage(): Language {
  try {
    const locales = getLocales();
    if (Array.isArray(locales) && locales.length > 0) {
      for (const loc of locales) {
        const fromCode = normalizeLocaleToLanguage(loc.languageCode);
        if (fromCode) {
          return fromCode;
        }
        const fromTag = normalizeLocaleToLanguage(loc.languageTag);
        if (fromTag) {
          return fromTag;
        }
      }
    }
  } catch (error) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('[localizationService] Failed to read native locales:', error);
    }
  }

  return DEFAULT_FALLBACK_LANGUAGE;
}

/**
 * Authoritative language resolution across all platforms:
 * - SQLite stored user preference is the authoritative source of truth.
 * - On initial clean installation (storedLanguage is null/undefined),
 *   detects system language as default via getNativeDeviceLanguage().
 * - Once explicitly selected, user preference persists and takes precedence.
 */
export function resolveAuthoritativeLanguage(storedLanguage?: Language | null): Language {
  if (storedLanguage && SUPPORTED_LANGUAGES.includes(storedLanguage)) {
    return storedLanguage;
  }

  return getNativeDeviceLanguage();
}

/**
 * Opens iOS system settings for the application via Linking.openSettings().
 * Returns true if successful, false if an error occurred.
 */
export async function openIosAppSettings(): Promise<boolean> {
  try {
    await Linking.openSettings();
    return true;
  } catch (error) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('[localizationService] Failed to open app settings:', error);
    }
    return false;
  }
}

/**
 * Development diagnostics for localization state.
 * Emits only technical locale identifiers, never private user fitness data.
 */
export function getLocalizationDiagnostics(resolvedLanguage: Language) {
  let nativeLocalesCount = 0;
  let primaryTag: string | null = null;

  try {
    const locales = getLocales();
    nativeLocalesCount = locales.length;
    primaryTag = locales[0]?.languageTag ?? null;
  } catch {
    // ignore in environments without native localization
  }

  return {
    platform: Platform.OS,
    resolvedLanguage,
    primaryTag,
    localesCount: nativeLocalesCount,
    isRTL: resolvedLanguage === 'ar',
  };
}
