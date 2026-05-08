import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { updateRestaurant } from '../../services/api';
import Card from '../../components/Card';
import { useT } from '../../i18n';

const formatCoord = (n: number | undefined | null): string =>
  typeof n === 'number' && !Number.isNaN(n) ? String(n) : '';

const parseCoord = (s: string): number | null => {
  const trimmed = s.trim().replace(',', '.');
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
};

export default function RestaurantLocationScreen() {
  const restaurant = useAuthStore((s) => s.restaurant);
  const loadRestaurants = useAuthStore((s) => s.loadRestaurants);
  const t = useT();

  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [saving, setSaving] = useState(false);
  const [edited, setEdited] = useState(false);

  useEffect(() => {
    if (restaurant) {
      setLatitude(formatCoord(restaurant.latitude));
      setLongitude(formatCoord(restaurant.longitude));
      setEdited(false);
    }
  }, [restaurant]);

  const handleLatChange = (v: string) => {
    setLatitude(v);
    setEdited(true);
  };

  const handleLngChange = (v: string) => {
    setLongitude(v);
    setEdited(true);
  };

  const handleSave = async () => {
    if (!restaurant || saving) return;

    const lat = parseCoord(latitude);
    const lng = parseCoord(longitude);

    if (lat === null || lng === null) {
      Alert.alert(t('location.invalidTitle'), t('location.invalidNumeric'));
      return;
    }
    if (lat < -90 || lat > 90) {
      Alert.alert(t('location.invalidTitle'), t('location.invalidLatRange'));
      return;
    }
    if (lng < -180 || lng > 180) {
      Alert.alert(t('location.invalidTitle'), t('location.invalidLngRange'));
      return;
    }

    setSaving(true);
    try {
      await updateRestaurant(restaurant.id, { latitude: lat, longitude: lng });
      await loadRestaurants();
      setEdited(false);
      Alert.alert(t('location.savedTitle'), t('location.savedMessage'));
    } catch (e: any) {
      Alert.alert(t('location.errorTitle'), e?.message ?? t('location.errorGeneric'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionTitle}>{t('location.title')}</Text>
        <Text style={styles.sectionSubtitle}>{t('location.subtitle')}</Text>

        <Card style={styles.fieldsCard}>
          <View style={styles.fieldRow}>
            <View style={styles.fieldIcon}>
              <Ionicons name="navigate-outline" size={20} color={Colors.accent} />
            </View>
            <View style={styles.fieldContent}>
              <Text style={styles.fieldLabel}>{t('location.latitude')}</Text>
              <TextInput
                style={styles.fieldInput}
                value={latitude}
                onChangeText={handleLatChange}
                placeholder="41.311158"
                placeholderTextColor={Colors.gray300}
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>
          <View style={[styles.fieldRow, styles.fieldBorderTop]}>
            <View style={styles.fieldIcon}>
              <Ionicons name="compass-outline" size={20} color={Colors.accent} />
            </View>
            <View style={styles.fieldContent}>
              <Text style={styles.fieldLabel}>{t('location.longitude')}</Text>
              <TextInput
                style={styles.fieldInput}
                value={longitude}
                onChangeText={handleLngChange}
                placeholder="69.279737"
                placeholderTextColor={Colors.gray300}
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>
        </Card>

        <Text style={styles.helperText}>{t('location.helper')}</Text>

        <TouchableOpacity
          style={[styles.saveButton, (!edited || saving) && styles.saveButtonDisabled]}
          onPress={handleSave}
          activeOpacity={0.8}
          disabled={!edited || saving}
        >
          {saving ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
              <Text style={styles.saveButtonText}>{t('location.save')}</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: Colors.gray50 },
  content: { padding: Spacing.base, paddingBottom: Spacing['2xl'] },

  sectionTitle: { ...Typography.headline, color: Colors.black, marginBottom: Spacing.xs },
  sectionSubtitle: { ...Typography.caption1, color: Colors.gray500, marginBottom: Spacing.base },

  fieldsCard: { padding: 0, marginBottom: Spacing.base },
  fieldRow: { flexDirection: 'row', alignItems: 'flex-start', padding: Spacing.base, minHeight: 56 },
  fieldBorderTop: { borderTopWidth: 1, borderTopColor: Colors.gray100 },
  fieldIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.accentLight, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md, marginTop: 2 },
  fieldContent: { flex: 1 },
  fieldLabel: { ...Typography.caption1, color: Colors.gray500, marginBottom: 4 },
  fieldInput: { ...Typography.body, color: Colors.black, padding: 0, margin: 0, minHeight: 24 },

  helperText: { ...Typography.caption1, color: Colors.gray500, marginBottom: Spacing.lg },

  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accent, borderRadius: BorderRadius.button, paddingVertical: Spacing.md, gap: Spacing.sm, minHeight: 48 },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { ...Typography.headline, color: Colors.white },
});
