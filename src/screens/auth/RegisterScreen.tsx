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

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Register'>;

export function RegisterScreen() {
  const navigation = useNavigation<Navigation>();
  const { register, profile } = useApp();
  const theme = useAppTheme();
  const { t, textDirectionStyle } = useLanguage();
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [goal, setGoal] = useState(profile.goal);
  const [password, setPassword] = useState('');

  function handleRegister() {
    if (!name.trim() || !email.trim() || password.length < 6) {
      Alert.alert(t('common.requiredTitle'), t('common.requiredMessage'));
      return;
    }

    register({ name: name.trim(), email: email.trim(), goal: goal.trim() || profile.goal });
  }

  return (
    <ScreenContainer>
      <AppHeader title={t('auth.registerTitle')} subtitle={t('auth.registerSubtitle')} />

      <AppCard>
        <AppInput label={t('common.name')} onChangeText={setName} placeholder={t('auth.namePlaceholder')} value={name} />
        <AppInput
          autoCapitalize="none"
          keyboardType="email-address"
          label={t('common.email')}
          onChangeText={setEmail}
          placeholder={t('auth.emailPlaceholder')}
          value={email}
        />
        <AppInput
          label={t('common.goal')}
          multiline
          onChangeText={setGoal}
          placeholder={t('auth.goalPlaceholder')}
          value={goal}
        />
        <AppInput
          label={t('common.password')}
          onChangeText={setPassword}
          placeholder={t('auth.passwordPlaceholder')}
          secureTextEntry
          value={password}
        />
        <AppButton title={t('auth.registerButton')} icon="person-add-outline" onPress={handleRegister} />
      </AppCard>

      <Pressable onPress={() => navigation.navigate('Login')} style={styles.linkWrap}>
        <Text style={[styles.link, textDirectionStyle, { color: theme.colors.primary }]}>
          {t('auth.haveAccount')}
        </Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  linkWrap: {
    alignSelf: 'stretch',
  },
  link: {
    fontSize: 14,
    fontWeight: '900',
  },
});
