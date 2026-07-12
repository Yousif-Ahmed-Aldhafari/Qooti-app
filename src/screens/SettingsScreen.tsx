import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppCard } from '../components/AppCard';
import { AppHeader } from '../components/AppHeader';
import type { Translator } from '../i18n';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { Language } from '../types';
import { activeRowDirection, activeTextAlign, activeWritingDirection } from '../utils/rtl';

type SettingsScreenProps = {
  t: Translator;
  language: Language;
  onLanguageChange: (language: Language) => void;
};

export function SettingsScreen({ t, language, onLanguageChange }: SettingsScreenProps) {
  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  const options: Array<{ value: Language; label: string }> = [
    { value: 'en', label: t('settings.english') },
    { value: 'ar', label: t('settings.arabic') },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <AppHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <AppCard>
        <Text style={[styles.sectionTitle, directionalText]}>{t('settings.language')}</Text>
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
                  { flexDirection: activeRowDirection(), opacity: pressed ? 0.78 : 1 },
                  selected ? styles.selectedOption : null,
                ]}
              >
                <View style={styles.optionIcon}>
                  <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={selected ? colors.accent : colors.textMuted} />
                </View>
                <View style={styles.optionCopy}>
                  <Text style={[styles.optionLabel, directionalText]}>{option.label}</Text>
                  {selected ? <Text style={[styles.optionMeta, directionalText]}>{t('settings.selected')}</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </AppCard>

      <AppCard>
        <Text style={[styles.sectionTitle, directionalText]}>{t('settings.aboutTitle')}</Text>
        <Text style={[styles.about, directionalText]}>{t('settings.about')}</Text>
      </AppCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: 120,
    gap: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
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
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.cardMuted,
  },
  selectedOption: {
    borderColor: colors.accent,
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
    color: colors.text,
  },
  optionMeta: {
    ...typography.caption,
    color: colors.accent,
  },
  about: {
    ...typography.body,
    color: colors.textMuted,
  },
});
