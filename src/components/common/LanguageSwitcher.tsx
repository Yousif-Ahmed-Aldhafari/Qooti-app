import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { Language } from '../../models/settings';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';

type LanguageSwitcherProps = {
  value: Language;
  onChange: (language: Language) => void;
};

export function LanguageSwitcher({ value, onChange }: LanguageSwitcherProps) {
  const theme = useAppTheme();
  const { t, contentDirectionStyle, rowDirectionStyle, textDirectionStyle } = useLanguage();
  const options: { language: Language; title: string; description: string }[] = [
    {
      language: 'en',
      title: t('language.english'),
      description: t('language.englishDescription'),
    },
    {
      language: 'ar',
      title: t('language.arabic'),
      description: t('language.arabicDescription'),
    },
  ];

  return (
    <View style={[styles.wrapper, contentDirectionStyle]}>
      {options.map((option) => {
        const selected = option.language === value;

        return (
          <Pressable
            accessibilityRole="button"
            key={option.language}
            onPress={() => onChange(option.language)}
            style={({ pressed }) => [
              styles.option,
              rowDirectionStyle,
              {
                borderColor: selected ? theme.colors.primary : theme.colors.border,
                backgroundColor: selected ? theme.colors.primaryMuted : theme.colors.surface,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <View style={styles.languageText}>
              <Text style={[styles.title, textDirectionStyle, { color: theme.colors.text }]}>
                {option.title}
              </Text>
              <Text style={[styles.description, textDirectionStyle, { color: theme.colors.textMuted }]}>
                {option.description}
              </Text>
            </View>
            <Ionicons
              name={selected ? 'checkmark-circle' : 'ellipse-outline'}
              size={24}
              color={selected ? theme.colors.primary : theme.colors.textMuted}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'stretch',
    gap: 12,
  },
  option: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    gap: 12,
  },
  languageText: {
    flex: 1,
    gap: 5,
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
  },
});
