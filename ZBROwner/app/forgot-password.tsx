import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/theme';
import { useT } from '../i18n';
import { requestPasswordReset } from '../services/api';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const validateEmail = useCallback((value: string) => {
    if (!value.trim()) {
      setEmailError(t('login.emailRequired'));
      return false;
    }
    if (!EMAIL_REGEX.test(value.trim())) {
      setEmailError(t('login.emailInvalid'));
      return false;
    }
    setEmailError('');
    return true;
  }, [t]);

  const handleSubmit = useCallback(async () => {
    if (!validateEmail(email)) return;

    setIsLoading(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (error: any) {
      Alert.alert(t('common.error'), error?.message || t('forgotPassword.requestFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [email, validateEmail, t]);

  if (sent) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="mail-open-outline" size={48} color={Colors.accent} />
          </View>
          <Text style={styles.successTitle}>{t('forgotPassword.emailSent')}</Text>
          <Text style={styles.successMessage}>{t('forgotPassword.checkInbox')}</Text>
          <TouchableOpacity style={styles.button} activeOpacity={0.8} onPress={() => router.back()}>
            <Text style={styles.buttonText}>{t('forgotPassword.backToLogin')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing['3xl'], paddingBottom: insets.bottom + Spacing['3xl'] }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={Colors.black} />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="key-outline" size={36} color={Colors.accent} />
          </View>
          <Text style={styles.title}>{t('forgotPassword.title')}</Text>
          <Text style={styles.subtitle}>{t('forgotPassword.subtitle')}</Text>
        </View>

        {/* Email field */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{t('login.email')}</Text>
          <View style={[styles.inputRow, emailError ? styles.inputRowError : null]}>
            <Ionicons name="mail-outline" size={20} color={emailError ? Colors.danger : Colors.gray400} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={t('login.emailPlaceholder')}
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

        {/* Submit */}
        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          activeOpacity={0.8}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.buttonText}>{t('forgotPassword.sendLink')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.white },
  content: { flexGrow: 1, paddingHorizontal: Spacing.xl },
  backButton: { marginBottom: Spacing.xl },
  header: { alignItems: 'center', marginBottom: Spacing['3xl'] },
  iconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.accentLight, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.base },
  title: { ...Typography.title2, color: Colors.black, marginBottom: Spacing.sm },
  subtitle: { ...Typography.body, color: Colors.gray500, textAlign: 'center' },
  fieldGroup: { marginBottom: Spacing.xl },
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
  button: {
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.button,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { ...Typography.headline, color: Colors.white },
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xl },
  successIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.accentLight, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.xl },
  successTitle: { ...Typography.title2, color: Colors.black, marginBottom: Spacing.sm },
  successMessage: { ...Typography.body, color: Colors.gray500, textAlign: 'center', marginBottom: Spacing['3xl'] },
});
