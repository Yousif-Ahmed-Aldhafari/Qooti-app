import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppCard } from '../components/AppCard';
import { AppHeader } from '../components/AppHeader';
import type { Translator } from '../i18n';
import { themeColors, type ResolvedTheme, type ThemePreference } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { Language } from '../types';
import { activeRowDirection, activeTextAlign, activeWritingDirection } from '../utils/rtl';

type SettingsScreenProps = {
  t: Translator;
  language: Language;
  themePreference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  onLanguageChange: (language: Language) => void;
  onThemeChange: (themePreference: ThemePreference) => void;
};

export function SettingsScreen({ t, language, themePreference, resolvedTheme, onLanguageChange, onThemeChange }: SettingsScreenProps) {
  const palette = themeColors();
  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  const options: Array<{ value: Language; label: string }> = [
    { value: 'en', label: t('settings.english') },
    { value: 'ar', label: t('settings.arabic') },
  ];
  const themeOptions: Array<{ value: ThemePreference; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { value: 'light', label: t('settings.lightMode'), icon: 'sunny-outline' },
    { value: 'dark', label: t('settings.darkMode'), icon: 'moon-outline' },
    { value: 'system', label: t('settings.systemMode'), icon: 'phone-portrait-outline' },
  ];

  return (
    <ScrollView style={[styles.screen, { backgroundColor: palette.background }]} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <AppHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <AppCard>
        <Text style={[styles.sectionTitle, directionalText, { color: palette.text }]}>{t('settings.language')}</Text>
        <View style={styles.options}>
          {options.map((option) => {
            const selected = option.value === language;

            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                onPress={() => onLanguageChange(option.value)}
                style={({ pressed }) => [
                  styles.option,
                  {
                    flexDirection: activeRowDirection(),
                    borderColor: selected ? palette.accent : palette.border,
                    backgroundColor: palette.cardMuted,
                    opacity: pressed ? 0.78 : 1,
                  },
                ]}
              >
                <View style={styles.optionIcon}>
                  <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={selected ? palette.accent : palette.textMuted} />
                </View>
                <View style={styles.optionCopy}>
                  <Text style={[styles.optionLabel, directionalText, { color: palette.text }]}>{option.label}</Text>
                  {selected ? <Text style={[styles.optionMeta, directionalText, { color: palette.accent }]}>{t('settings.selected')}</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </AppCard>

      <AppCard>
        <Text style={[styles.sectionTitle, directionalText, { color: palette.text }]}>{t('settings.appearance')}</Text>
        <Text style={[styles.about, directionalText, { color: palette.textMuted }]}>{t('settings.theme')}</Text>
        <View style={styles.options}>
          {themeOptions.map((option) => {
            const selected = option.value === themePreference;

            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                onPress={() => onThemeChange(option.value)}
                style={({ pressed }) => [
                  styles.option,
                  {
                    flexDirection: activeRowDirection(),
                    borderColor: selected ? palette.accent : palette.border,
                    backgroundColor: palette.cardMuted,
                    opacity: pressed ? 0.78 : 1,
                  },
                ]}
              >
                <View style={styles.optionIcon}>
                  <Ionicons name={option.icon} size={22} color={selected ? palette.accent : palette.textMuted} />
                </View>
                <View style={styles.optionCopy}>
                  <Text style={[styles.optionLabel, directionalText, { color: palette.text }]}>{option.label}</Text>
                  {selected ? (
                    <Text style={[styles.optionMeta, directionalText, { color: palette.accent }]}>
                      {option.value === 'system'
                        ? `${t('settings.selected')} - ${resolvedTheme === 'dark' ? t('settings.darkMode') : t('settings.lightMode')}`
                        : t('settings.selected')}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </AppCard>

      <AppCard>
        <Text style={[styles.sectionTitle, directionalText, { color: palette.text }]}>{t('settings.aboutTitle')}</Text>
        <Text style={[styles.about, directionalText, { color: palette.textMuted }]}>{t('settings.about')}</Text>
      </AppCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: 120,
    gap: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
  },
  options: {
    gap: spacing.md,
  },
  option: {
    minHeight: 62,
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  optionIcon: {
    width: 32,
    alignItems: 'center',
  },
  optionCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  optionLabel: {
    ...typography.body,
  },
  optionMeta: {
    ...typography.caption,
  },
  about: {
    ...typography.body,
  },
});
