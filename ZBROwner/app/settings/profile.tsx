import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { updateRestaurant } from '../../services/api';
import Card from '../../components/Card';
import { useT } from '../../i18n';
import type { UpdateRestaurantRequest } from '../../types';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface Field {
  key: keyof UpdateRestaurantRequest;
  label: string;
  icon: IoniconsName;
  keyboard?: 'default' | 'phone-pad' | 'email-address' | 'numeric';
  multiline?: boolean;
}

export default function RestaurantProfileScreen() {
  const restaurant = useAuthStore((s) => s.restaurant);
  const loadRestaurants = useAuthStore((s) => s.loadRestaurants);
  const t = useT();

  const [form, setForm] = useState<UpdateRestaurantRequest>({});
  const [saving, setSaving] = useState(false);
  const [edited, setEdited] = useState(false);

  useEffect(() => {
    if (restaurant) {
      setForm({
        name: restaurant.name,
        description: restaurant.description,
        phone: restaurant.phone,
        email: restaurant.email,
        addressLine1: restaurant.addressLine1,
        city: restaurant.city,
        state: restaurant.state,
        postalCode: restaurant.postalCode,
        country: restaurant.country,
        minimumOrder: restaurant.minimumOrder,
        deliveryFee: restaurant.deliveryFee,
        deliveryRadiusKm: restaurant.deliveryRadiusKm,
        averagePrepTimeMinutes: restaurant.averagePrepTimeMinutes,
        opensAt: restaurant.opensAt ?? '',
        closesAt: restaurant.closesAt ?? '',
      });
      setEdited(false);
    }
  }, [restaurant]);

  const updateField = (key: keyof UpdateRestaurantRequest, value: string) => {
    setEdited(true);
    const numericKeys: (keyof UpdateRestaurantRequest)[] = ['minimumOrder', 'deliveryFee', 'deliveryRadiusKm', 'averagePrepTimeMinutes'];
    if (numericKeys.includes(key)) {
      setForm((f) => ({ ...f, [key]: value === '' ? undefined : Number(value) }));
    } else {
      setForm((f) => ({ ...f, [key]: value }));
    }
  };

  const handleSave = async () => {
    if (!restaurant || saving) return;
    setSaving(true);
    try {
      await updateRestaurant(restaurant.id, form);
      await loadRestaurants();
      setEdited(false);
    } catch {
      // TODO: show error toast
    } finally {
      setSaving(false);
    }
  };

  const fields: Field[] = [
    { key: 'name', label: t('profile.restaurantName'), icon: 'storefront-outline' },
    { key: 'description', label: t('profile.aboutSection'), icon: 'document-text-outline', multiline: true },
    { key: 'phone', label: t('profile.phone'), icon: 'call-outline', keyboard: 'phone-pad' },
    { key: 'email', label: t('profile.email'), icon: 'mail-outline', keyboard: 'email-address' },
    { key: 'addressLine1', label: t('profile.address'), icon: 'location-outline' },
    { key: 'city', label: t('profile.city'), icon: 'business-outline' },
    { key: 'state', label: t('profile.state'), icon: 'map-outline' },
    { key: 'postalCode', label: t('profile.postalCode'), icon: 'mail-open-outline' },
    { key: 'averagePrepTimeMinutes', label: t('profile.avgPrepTime'), icon: 'time-outline', keyboard: 'numeric' },
    { key: 'deliveryRadiusKm', label: t('profile.deliveryRadius'), icon: 'navigate-outline', keyboard: 'numeric' },
    { key: 'minimumOrder', label: t('profile.minimumOrder'), icon: 'cash-outline', keyboard: 'numeric' },
    { key: 'deliveryFee', label: t('profile.deliveryFee'), icon: 'bicycle-outline', keyboard: 'numeric' },
    { key: 'opensAt', label: t('profile.opensAt'), icon: 'sunny-outline' },
    { key: 'closesAt', label: t('profile.closesAt'), icon: 'moon-outline' },
  ];

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Ionicons name="restaurant" size={40} color={Colors.accent} />
          </View>
          <Text style={styles.restaurantName}>{restaurant?.name ?? ''}</Text>
        </View>

        {/* Editable Fields */}
        <Card style={styles.fieldsCard}>
          {fields.map((field, index) => (
            <View key={field.key} style={[styles.fieldRow, index < fields.length - 1 && styles.fieldBorder]}>
              <View style={styles.fieldIcon}>
                <Ionicons name={field.icon} size={20} color={Colors.accent} />
              </View>
              <View style={styles.fieldContent}>
                <Text style={styles.fieldLabel}>{field.label}</Text>
                <TextInput
                  style={[styles.fieldInput, field.multiline && styles.fieldInputMultiline]}
                  value={String(form[field.key] ?? '')}
                  onChangeText={(v) => updateField(field.key, v)}
                  keyboardType={field.keyboard ?? 'default'}
                  multiline={field.multiline}
                  placeholder="—"
                  placeholderTextColor={Colors.gray300}
                />
              </View>
            </View>
          ))}
        </Card>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, !edited && styles.saveButtonDisabled]}
          onPress={handleSave}
          activeOpacity={0.8}
          disabled={!edited || saving}
        >
          {saving ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
              <Text style={styles.saveButtonText}>{t('profile.save')}</Text>
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
  content: { padding: Spacing.base, paddingBottom: 100 },
  avatarSection: { alignItems: 'center', marginBottom: Spacing.xl },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.accentLight, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
  restaurantName: { ...Typography.title2, color: Colors.black },
  fieldsCard: { padding: 0, marginBottom: Spacing.xl },
  fieldRow: { flexDirection: 'row', alignItems: 'flex-start', padding: Spacing.base, minHeight: 56 },
  fieldBorder: { borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  fieldIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.accentLight, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md, marginTop: 2 },
  fieldContent: { flex: 1 },
  fieldLabel: { ...Typography.caption1, color: Colors.gray500, marginBottom: 4 },
  fieldInput: { ...Typography.body, color: Colors.black, padding: 0, margin: 0, minHeight: 24 },
  fieldInputMultiline: { minHeight: 60, textAlignVertical: 'top' },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accent, borderRadius: BorderRadius.button, paddingVertical: Spacing.md, gap: Spacing.sm, minHeight: 48 },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { ...Typography.headline, color: Colors.white },
});
