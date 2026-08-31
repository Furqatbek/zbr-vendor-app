import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { useT } from '../../i18n';
import { CONTACT } from '../../constants/contact';
import Card from '../../components/Card';

/**
 * In-app account deletion.
 *
 * Required by App Store Review Guideline 5.1.1(v): an app with accounts must let
 * the user INITIATE deletion from inside the app. A link to a web form does not
 * satisfy Apple (it does satisfy Google's Data deletion policy).
 *
 * The confirmation is type-your-email rather than type-"DELETE" so it works
 * identically in all four shipped languages without translating a keyword, and
 * it cannot be satisfied by muscle memory.
 */
export default function DeleteAccountScreen() {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const restaurant = useAuthStore((s) => s.restaurant);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);

  const [confirmation, setConfirmation] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const expected = (user?.email ?? '').trim().toLowerCase();
  const matches = expected.length > 0 && confirmation.trim().toLowerCase() === expected;

  const consequences = [
    t('deleteAccount.consequenceOrders'),
    t('deleteAccount.consequenceListing'),
    t('deleteAccount.consequenceAccess'),
    t('deleteAccount.consequenceRecords'),
  ];

  const performDelete = async () => {
    setSubmitting(true);
    try {
      await deleteAccount(reason.trim() || undefined);
      // On success the session is cleared, so the root layout returns to login.
      // No success dialog: the screen it would sit on is already gone.
    } catch (e: any) {
      setSubmitting(false);
      Alert.alert(
        t('deleteAccount.failedTitle'),
        e?.message || t('deleteAccount.failedMessage'),
        CONTACT.supportEmail
          ? [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('deleteAccount.contactSupport'),
                onPress: () =>
                  Linking.openURL(
                    `mailto:${CONTACT.supportEmail}?subject=${encodeURIComponent(
                      t('deleteAccount.emailSubject'),
                    )}`,
                  ),
              },
            ]
          : [{ text: t('common.ok') }],
      );
    }
  };

  const confirm = () => {
    Alert.alert(t('deleteAccount.finalTitle'), t('deleteAccount.finalMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('deleteAccount.confirmDelete'), style: 'destructive', onPress: performDelete },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.warningIcon}>
          <Ionicons name="warning-outline" size={32} color={Colors.danger} />
        </View>

        <Text style={styles.title}>{t('deleteAccount.title')}</Text>
        <Text style={styles.intro}>
          {restaurant?.name
            ? t('deleteAccount.introWithRestaurant', { restaurant: restaurant.name })
            : t('deleteAccount.intro')}
        </Text>

        <Card style={styles.consequencesCard}>
          <Text style={styles.consequencesTitle}>{t('deleteAccount.whatHappens')}</Text>
          {consequences.map((line) => (
            <View key={line} style={styles.consequenceRow}>
              <Ionicons name="close-circle" size={16} color={Colors.danger} style={styles.bullet} />
              <Text style={styles.consequenceText}>{line}</Text>
            </View>
          ))}
        </Card>

        <Text style={styles.irreversible}>{t('deleteAccount.irreversible')}</Text>

        <Text style={styles.label}>{t('deleteAccount.reasonLabel')}</Text>
        <TextInput
          style={[styles.input, styles.reasonInput]}
          value={reason}
          onChangeText={setReason}
          placeholder={t('deleteAccount.reasonPlaceholder')}
          placeholderTextColor={Colors.gray400}
          multiline
          maxLength={500}
          editable={!submitting}
        />

        <Text style={styles.label}>{t('deleteAccount.confirmLabel', { email: user?.email ?? '' })}</Text>
        <TextInput
          style={styles.input}
          value={confirmation}
          onChangeText={setConfirmation}
          placeholder={user?.email ?? ''}
          placeholderTextColor={Colors.gray400}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          editable={!submitting}
        />

        <TouchableOpacity
          style={[styles.deleteButton, (!matches || submitting) && styles.deleteButtonDisabled]}
          onPress={confirm}
          disabled={!matches || submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <>
              <Ionicons name="trash-outline" size={18} color={Colors.white} />
              <Text style={styles.deleteButtonText}>{t('deleteAccount.deleteButton')}</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.helper}>{t('deleteAccount.helper')}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: Colors.gray50 },
  content: { padding: Spacing.base, paddingBottom: 120 },
  warningIcon: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.dangerLight,
    justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginTop: Spacing.base,
  },
  title: { ...Typography.title2, color: Colors.black, textAlign: 'center', marginTop: Spacing.base },
  intro: { ...Typography.subhead, color: Colors.gray600, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 22 },
  consequencesCard: { marginTop: Spacing.lg },
  consequencesTitle: { ...Typography.headline, color: Colors.black, marginBottom: Spacing.sm },
  consequenceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.sm },
  bullet: { marginTop: 2 },
  consequenceText: { ...Typography.subhead, color: Colors.gray600, flex: 1, lineHeight: 21 },
  irreversible: {
    ...Typography.subhead, fontWeight: '600', color: Colors.danger,
    textAlign: 'center', marginTop: Spacing.base,
  },
  label: { ...Typography.footnote, color: Colors.gray600, marginTop: Spacing.lg, marginBottom: 6 },
  input: {
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.gray200,
    borderRadius: BorderRadius.button, padding: Spacing.base,
    ...Typography.body, color: Colors.black,
  },
  reasonInput: { minHeight: 80, textAlignVertical: 'top' },
  deleteButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.danger, borderRadius: BorderRadius.button,
    paddingVertical: Spacing.base, marginTop: Spacing.lg, minHeight: 52,
  },
  deleteButtonDisabled: { backgroundColor: Colors.gray300 },
  deleteButtonText: { ...Typography.headline, color: Colors.white },
  helper: { ...Typography.caption1, color: Colors.gray500, textAlign: 'center', marginTop: Spacing.base, lineHeight: 18 },
});
