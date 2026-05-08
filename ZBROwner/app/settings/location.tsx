import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { updateRestaurant } from '../../services/api';
import Card from '../../components/Card';
import MapPicker from '../../components/MapPicker';
import { useT } from '../../i18n';

const formatCoord = (n: number | undefined | null): string =>
  typeof n === 'number' && !Number.isNaN(n) ? String(n) : '';

const parseCoord = (s: string): number | null => {
  const trimmed = s.trim().replace(',', '.');
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
};

const validateCoords = (
  lat: number | null,
  lng: number | null,
): { ok: true; lat: number; lng: number } | { ok: false; messageKey: string } => {
  if (lat === null || lng === null) return { ok: false, messageKey: 'location.invalidNumeric' };
  if (lat < -90 || lat > 90) return { ok: false, messageKey: 'location.invalidLatRange' };
  if (lng < -180 || lng > 180) return { ok: false, messageKey: 'location.invalidLngRange' };
  return { ok: true, lat, lng };
};

export default function RestaurantLocationScreen() {
  const restaurant = useAuthStore((s) => s.restaurant);
  const loadRestaurants = useAuthStore((s) => s.loadRestaurants);
  const t = useT();

  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [edited, setEdited] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

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

  const handleDetect = async () => {
    if (detecting) return;
    setDetecting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('location.permissionTitle'), t('location.permissionDenied'));
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const lat = Number(pos.coords.latitude.toFixed(6));
      const lng = Number(pos.coords.longitude.toFixed(6));
      setLatitude(String(lat));
      setLongitude(String(lng));
      setEdited(true);
    } catch (e: any) {
      Alert.alert(t('location.errorTitle'), e?.message ?? t('location.detectFailed'));
    } finally {
      setDetecting(false);
    }
  };

  const handlePickOnMap = () => {
    setPickerVisible(true);
  };

  const handleMapConfirm = (coords: { lat: number; lng: number }) => {
    setLatitude(String(coords.lat));
    setLongitude(String(coords.lng));
    setEdited(true);
    setPickerVisible(false);
  };

  const handleSave = async () => {
    if (!restaurant || saving) return;

    const v = validateCoords(parseCoord(latitude), parseCoord(longitude));
    if (!v.ok) {
      Alert.alert(t('location.invalidTitle'), t(v.messageKey as any));
      return;
    }

    setSaving(true);
    try {
      await updateRestaurant(restaurant.id, {
        name: restaurant.name,
        description: restaurant.description,
        phone: restaurant.phone,
        email: restaurant.email,
        addressLine1: restaurant.addressLine1,
        city: restaurant.city,
        state: restaurant.state,
        postalCode: restaurant.postalCode,
        country: restaurant.country,
        acceptsDelivery: restaurant.acceptsDelivery,
        acceptsTakeaway: restaurant.acceptsTakeaway,
        acceptsDineIn: restaurant.acceptsDineIn,
        minimumOrder: restaurant.minimumOrder,
        deliveryFee: restaurant.deliveryFee,
        deliveryRadiusKm: restaurant.deliveryRadiusKm,
        averagePrepTimeMinutes: restaurant.averagePrepTimeMinutes,
        opensAt: restaurant.opensAt,
        closesAt: restaurant.closesAt,
        latitude: v.lat,
        longitude: v.lng,
      });
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

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton, detecting && styles.buttonDisabled]}
            onPress={handleDetect}
            disabled={detecting}
            activeOpacity={0.8}
          >
            {detecting ? (
              <ActivityIndicator size="small" color={Colors.accent} />
            ) : (
              <>
                <Ionicons name="locate-outline" size={18} color={Colors.accent} />
                <Text style={styles.secondaryButtonText}>{t('location.detect')}</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={handlePickOnMap}
            activeOpacity={0.8}
          >
            <Ionicons name="map-outline" size={18} color={Colors.accent} />
            <Text style={styles.secondaryButtonText}>{t('location.pickOnMap')}</Text>
          </TouchableOpacity>
        </View>

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

      <MapPicker
        visible={pickerVisible}
        initialLat={parseCoord(latitude)}
        initialLng={parseCoord(longitude)}
        onConfirm={handleMapConfirm}
        onClose={() => setPickerVisible(false)}
      />
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

  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.base },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.button, paddingVertical: Spacing.md, gap: Spacing.sm, minHeight: 48 },
  secondaryButton: { backgroundColor: Colors.accentLight, borderWidth: 1, borderColor: Colors.accent },
  secondaryButtonText: { ...Typography.headline, color: Colors.accent },
  buttonDisabled: { opacity: 0.5 },

  helperText: { ...Typography.caption1, color: Colors.gray500, marginBottom: Spacing.lg },

  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accent, borderRadius: BorderRadius.button, paddingVertical: Spacing.md, gap: Spacing.sm, minHeight: 48 },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { ...Typography.headline, color: Colors.white },
});
