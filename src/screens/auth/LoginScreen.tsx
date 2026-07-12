import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppHeader } from '../../components/common/AppHeader';
import { AppInput } from '../../components/common/AppInput';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';
import type { RootStackParamList } from '../../navigation/types';
import { useApp } from '../../store/AppContext';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export function LoginScreen() {
  const navigation = useNavigation<Navigation>();
  const { login, profile } = useApp();
  const theme = useAppTheme();
  const { t, textDirectionStyle } = useLanguage();
  const [email, setEmail] = useState(profile.email);
  const [password, setPassword] = useState('');

  function handleLogin() {
    if (!email.trim() || password.length < 6) {
      Alert.alert(t('common.requiredTitle'), t('common.requiredMessage'));
      return;
    }

    login(email.trim());
  }

  return (
    <ScreenContainer contentStyle={styles.content}>
      <AppHeader title={t('auth.loginTitle')} subtitle={t('auth.loginSubtitle')} />

      <AppCard>
        <AppInput
          autoCapitalize="none"
          keyboardType="email-address"
          label={t('common.email')}
          onChangeText={setEmail}
          placeholder={t('auth.emailPlaceholder')}
          value={email}
        />
        <AppInput
          label={t('common.password')}
          onChangeText={setPassword}
          placeholder={t('auth.passwordPlaceholder')}
          secureTextEntry
          value={password}
        />
        <AppButton title={t('auth.loginButton')} icon="log-in-outline" onPress={handleLogin} />
      </AppCard>

      <Pressable onPress={() => navigation.navigate('Register')} style={styles.linkWrap}>
        <Text style={[styles.link, textDirectionStyle, { color: theme.colors.primary }]}>
          {t('auth.needAccount')}
        </Text>
      </Pressable>

      <View style={[styles.note, { backgroundColor: theme.colors.primaryMuted }]}>
        <Text style={[styles.noteText, textDirectionStyle, { color: theme.colors.primary }]}>
          {t('auth.localOnly')}
        </Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  linkWrap: {
    alignSelf: 'stretch',
  },
  link: {
    fontSize: 14,
    fontWeight: '900',
  },
  note: {
    borderRadius: 18,
    padding: 14,
  },
  noteText: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
  },
});
