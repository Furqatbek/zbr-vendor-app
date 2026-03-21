import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/theme';
import { useT } from '../i18n';
import { useAuthStore } from '../store/authStore';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login, isLoading } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const validateEmail = useCallback((value: string) => {
    if (!value.trim()) {
      setEmailError(t('login.emailRequired' as any));
      return false;
    }
    if (!EMAIL_REGEX.test(value.trim())) {
      setEmailError(t('login.emailInvalid' as any));
      return false;
    }
    setEmailError('');
    return true;
  }, [t]);

  const handleLogin = useCallback(async () => {
    const isEmailValid = validateEmail(email);
    let isPasswordValid = true;

    if (!password) {
      setPasswordError(t('login.passwordRequired' as any));
      isPasswordValid = false;
    } else {
      setPasswordError('');
    }

    if (!isEmailValid || !isPasswordValid) return;

    try {
      await login(email.trim(), password);
      router.replace('/(tabs)');
    } catch (error: any) {
      const message = error?.message || t('login.loginFailed' as any);
      Alert.alert(t('common.error' as any), message);
    }
  }, [email, password, validateEmail, t, router, login]);

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing['3xl'], paddingBottom: insets.bottom + Spacing['3xl'] }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.hero}>
          <View style={styles.logoCircle}>
            <Ionicons name="storefront" size={40} color={Colors.accent} />
          </View>
          <Text style={styles.appName}>{t('login.appName' as any)}</Text>
          <Text style={styles.tagline}>{t('login.tagline' as any)}</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.title}>{t('login.signIn' as any)}</Text>

          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('login.email' as any)}</Text>
            <View style={[styles.inputRow, emailError ? styles.inputRowError : null]}>
              <Ionicons name="mail-outline" size={20} color={emailError ? Colors.danger : Colors.gray400} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('login.emailPlaceholder' as any)}
                placeholderTextColor={Colors.gray400}
                value={email}
                onChangeText={(v) => { setEmail(v); if (emailError) validateEmail(v); }}
                onBlur={() => email && validateEmail(email)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                editable={!isLoading}
              />
            </View>
            {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('login.password' as any)}</Text>
            <View style={[styles.inputRow, passwordError ? styles.inputRowError : null]}>
              <Ionicons name="lock-closed-outline" size={20} color={passwordError ? Colors.danger : Colors.gray400} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('login.passwordPlaceholder' as any)}
                placeholderTextColor={Colors.gray400}
                value={password}
                onChangeText={(v) => { setPassword(v); if (passwordError) setPasswordError(''); }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
                editable={!isLoading}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={Colors.gray400} />
              </TouchableOpacity>
            </View>
            {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
          </View>

          {/* Forgot Password */}
          <TouchableOpacity
            style={styles.forgotRow}
            activeOpacity={0.7}
            onPress={() => router.push('/forgot-password' as any)}
            disabled={isLoading}
          >
            <Text style={styles.forgotText}>{t('login.forgotPassword' as any)}</Text>
          </TouchableOpacity>

          {/* Sign In Button */}
          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            activeOpacity={0.8}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.buttonText}>{t('login.signIn' as any)}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.white },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: Spacing.xl },
  hero: { alignItems: 'center', marginBottom: Spacing['3xl'] },
  logoCircle: { width: 80, height: 80, borderRadius: 20, backgroundColor: Colors.accentLight, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
  appName: { ...Typography.title1, color: Colors.black },
  tagline: { ...Typography.subhead, color: Colors.gray500, marginTop: Spacing.xs },
  form: {},
  title: { ...Typography.title2, color: Colors.black, marginBottom: Spacing.xl },
  fieldGroup: { marginBottom: Spacing.base },
  label: { ...Typography.headline, color: Colors.gray700, marginBottom: Spacing.sm },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gray50,
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderRadius: BorderRadius.button,
    paddingHorizontal: Spacing.base,
    height: 52,
  },
  inputRowError: { borderColor: Colors.danger, backgroundColor: Colors.dangerLight },
  inputIcon: { marginRight: Spacing.sm },
  input: { flex: 1, ...Typography.body, color: Colors.black, height: '100%' as any },
  errorText: { ...Typography.caption1, color: Colors.danger, marginTop: Spacing.xs },
  forgotRow: { alignSelf: 'flex-end', marginBottom: Spacing.xl },
  forgotText: { ...Typography.subhead, color: Colors.accent, fontWeight: '500' },
  button: {
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.button,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { ...Typography.headline, color: Colors.white },
});
