import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ActivityIndicator, Image, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { updateRestaurant, uploadRestaurantLogo, uploadRestaurantCoverImage } from '../../services/api';
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
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

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

  const pickAndUploadImage = async (type: 'logo' | 'cover') => {
    if (!restaurant) return;

    const setUploading = type === 'logo' ? setUploadingLogo : setUploadingCover;
    const aspect: [number, number] = type === 'logo' ? [1, 1] : [16, 9];

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setUploading(true);
    try {
      const uploadFn = type === 'logo' ? uploadRestaurantLogo : uploadRestaurantCoverImage;
      await uploadFn(restaurant.id, asset.uri, asset.mimeType ?? undefined);
      await loadRestaurants();
    } catch (e: any) {
      const msg = e?.message ?? 'Could not upload image';
      console.error(`[profile] ${type} upload failed:`, e);
      Alert.alert('Upload failed', msg);
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.alert === 'function') {
        // react-native-web's Alert.alert can no-op; ensure the user sees the error.
        window.alert(`Upload failed: ${msg}`);
      }
    } finally {
      setUploading(false);
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
        {/* Cover Image */}
        <TouchableOpacity
          style={styles.coverSection}
          onPress={() => pickAndUploadImage('cover')}
          activeOpacity={0.8}
          disabled={uploadingCover}
        >
          {restaurant?.coverImageUrl ? (
            <Image source={{ uri: restaurant.coverImageUrl }} style={styles.coverImage} />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="image-outline" size={32} color={Colors.gray400} />
              <Text style={styles.coverPlaceholderText}>Tap to add cover image</Text>
            </View>
          )}
          {uploadingCover && (
            <View style={styles.coverOverlay}>
              <ActivityIndicator color={Colors.white} size="small" />
            </View>
          )}
          <View style={styles.coverEditBadge}>
            <Ionicons name="camera" size={14} color={Colors.white} />
          </View>
        </TouchableOpacity>

        {/* Logo / Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            style={styles.avatarWrapper}
            onPress={() => pickAndUploadImage('logo')}
            activeOpacity={0.8}
            disabled={uploadingLogo}
          >
            {restaurant?.logoUrl ? (
              <Image source={{ uri: restaurant.logoUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Ionicons name="restaurant" size={40} color={Colors.accent} />
              </View>
            )}
            {uploadingLogo && (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color={Colors.white} size="small" />
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <Ionicons name="camera" size={12} color={Colors.white} />
            </View>
          </TouchableOpacity>
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
  content: { paddingBottom: 100 },

  // Cover image
  coverSection: { width: '100%', height: 180, backgroundColor: Colors.gray200, position: 'relative' },
  coverImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  coverPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  coverPlaceholderText: { ...Typography.caption1, color: Colors.gray400, marginTop: Spacing.xs },
  coverOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  coverEditBadge: {
    position: 'absolute', bottom: Spacing.sm, right: Spacing.sm,
    width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },

  // Logo / Avatar
  avatarSection: { alignItems: 'center', marginTop: -40, marginBottom: Spacing.lg, paddingHorizontal: Spacing.base },
  avatarWrapper: { position: 'relative' },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.accentLight, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: Colors.white },
  avatarImage: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: Colors.white },
  avatarOverlay: { ...StyleSheet.absoluteFillObject, borderRadius: 40, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.accent,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.white,
  },
  restaurantName: { ...Typography.title2, color: Colors.black, marginTop: Spacing.sm },

  // Fields
  fieldsCard: { padding: 0, marginHorizontal: Spacing.base, marginBottom: Spacing.xl },
  fieldRow: { flexDirection: 'row', alignItems: 'flex-start', padding: Spacing.base, minHeight: 56 },
  fieldBorder: { borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  fieldIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.accentLight, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md, marginTop: 2 },
  fieldContent: { flex: 1 },
  fieldLabel: { ...Typography.caption1, color: Colors.gray500, marginBottom: 4 },
  fieldInput: { ...Typography.body, color: Colors.black, padding: 0, margin: 0, minHeight: 24 },
  fieldInputMultiline: { minHeight: 60, textAlignVertical: 'top' },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accent, borderRadius: BorderRadius.button, paddingVertical: Spacing.md, gap: Spacing.sm, minHeight: 48, marginHorizontal: Spacing.base },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { ...Typography.headline, color: Colors.white },
});
