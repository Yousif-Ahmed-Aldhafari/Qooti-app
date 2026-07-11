import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
};

export function Screen({ children, scroll = true, contentStyle }: ScreenProps) {
  const theme = useAppTheme();
  const { contentDirectionStyle } = useLanguage();

  return (
    <SafeAreaView style={[styles.safeArea, contentDirectionStyle, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.content, contentDirectionStyle, contentStyle]}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.content, styles.flexContent, contentDirectionStyle, contentStyle]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboard: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 16,
    width: '100%',
  },
  flexContent: {
    flex: 1,
  },
});
