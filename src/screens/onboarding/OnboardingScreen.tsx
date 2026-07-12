import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';
import { useApp } from '../../store/AppContext';

type Slide = {
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  bodyKey: string;
};

const slides: Slide[] = [
  { icon: 'restaurant-outline', titleKey: 'onboarding.slide1Title', bodyKey: 'onboarding.slide1Body' },
  { icon: 'barbell-outline', titleKey: 'onboarding.slide2Title', bodyKey: 'onboarding.slide2Body' },
  { icon: 'stats-chart-outline', titleKey: 'onboarding.slide3Title', bodyKey: 'onboarding.slide3Body' },
];

export function OnboardingScreen() {
  const { completeOnboarding } = useApp();
  const theme = useAppTheme();
  const { t, rowDirectionStyle, textDirectionStyle } = useLanguage();
  const [index, setIndex] = useState(0);
  const slide = slides[index];
  const isLast = index === slides.length - 1;

  function handleNext() {
    if (isLast) {
      completeOnboarding();
      return;
    }

    setIndex((current) => current + 1);
  }

  return (
    <ScreenContainer scroll={false} contentStyle={styles.content}>
      <View style={[styles.topBar, rowDirectionStyle]}>
        <Text style={[styles.brand, textDirectionStyle, { color: theme.colors.text }]}>{t('app.name')}</Text>
        <Pressable onPress={completeOnboarding}>
          <Text style={[styles.skip, { color: theme.colors.textMuted }]}>{t('common.skip')}</Text>
        </Pressable>
      </View>

      <View style={styles.visualWrap}>
        <View style={[styles.visual, { backgroundColor: theme.colors.primary }]}>
          <View style={[styles.orbit, { borderColor: theme.colors.surface }]} />
          <Ionicons name={slide.icon} color="#FFFFFF" size={84} />
          <View style={[styles.badge, { backgroundColor: theme.colors.accent }]}>
            <Ionicons name="flash" color={theme.colors.text} size={24} />
          </View>
        </View>
      </View>

      <AppCard style={styles.card}>
        <Text style={[styles.title, textDirectionStyle, { color: theme.colors.text }]}>
          {t(slide.titleKey)}
        </Text>
        <Text style={[styles.body, textDirectionStyle, { color: theme.colors.textMuted }]}>
          {t(slide.bodyKey)}
        </Text>
        <View style={[styles.dots, rowDirectionStyle]}>
          {slides.map((item, itemIndex) => (
            <View
              key={item.titleKey}
              style={[
                styles.dot,
                {
                  width: itemIndex === index ? 26 : 8,
                  backgroundColor: itemIndex === index ? theme.colors.primary : theme.colors.border,
                },
              ]}
            />
          ))}
        </View>
      </AppCard>

      <AppButton
        title={isLast ? t('common.start') : t('common.next')}
        icon={isLast ? 'checkmark' : 'arrow-forward'}
        onPress={handleNext}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: 28,
  },
  topBar: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    flex: 1,
    fontSize: 24,
    fontWeight: '900',
  },
  skip: {
    fontSize: 14,
    fontWeight: '900',
  },
  visualWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  visual: {
    width: 260,
    height: 300,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  orbit: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 22,
    opacity: 0.18,
  },
  badge: {
    position: 'absolute',
    bottom: 28,
    width: 58,
    height: 58,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    padding: 22,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
  },
  body: {
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '600',
  },
  dots: {
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 999,
  },
});
