import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { updateRestaurant } from '../../services/api';
import Card from '../../components/Card';
import { useT } from '../../i18n';

export default function WorkingHoursScreen() {
  const restaurant = useAuthStore((s) => s.restaurant);
  const loadRestaurants = useAuthStore((s) => s.loadRestaurants);
  const t = useT();

  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [edited, setEdited] = useState(false);

  useEffect(() => {
    if (restaurant) {
      setOpensAt(restaurant.opensAt ?? '');
      setClosesAt(restaurant.closesAt ?? '');
      setEdited(false);
    }
  }, [restaurant]);

  const handleSave = async () => {
    if (!restaurant || saving) return;
    setSaving(true);
    try {
      await updateRestaurant(restaurant.id, { opensAt, closesAt });
      await loadRestaurants();
      setEdited(false);
    } catch {
      // TODO: show error toast
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.subtitle}>{t('workingHoursScreen.subtitle')}</Text>

      <Card style={styles.card}>
        {/* Opens At */}
        <View style={styles.fieldRow}>
          <View style={styles.fieldIcon}>
            <Ionicons name="sunny-outline" size={20} color={Colors.accent} />
          </View>
          <View style={styles.fieldContent}>
            <Text style={styles.fieldLabel}>{t('workingHoursScreen.opensAt')}</Text>
            <TextInput
              style={styles.fieldInput}
              value={opensAt}
              onChangeText={(v) => { setOpensAt(v); setEdited(true); }}
              placeholder="10:00"
              placeholderTextColor={Colors.gray300}
            />
          </View>
        </View>

        <View style={styles.fieldBorder} />

        {/* Closes At */}
        <View style={styles.fieldRow}>
          <View style={styles.fieldIcon}>
            <Ionicons name="moon-outline" size={20} color={Colors.accent} />
          </View>
          <View style={styles.fieldContent}>
            <Text style={styles.fieldLabel}>{t('workingHoursScreen.closesAt')}</Text>
            <TextInput
              style={styles.fieldInput}
              value={closesAt}
              onChangeText={(v) => { setClosesAt(v); setEdited(true); }}
              placeholder="22:00"
              placeholderTextColor={Colors.gray300}
            />
          </View>
        </View>
      </Card>

      {/* Current Status */}
      <Card style={styles.statusCard}>
        <View style={styles.statusRow}>
          <Ionicons
            name={restaurant?.isCurrentlyOpen ? 'checkmark-circle' : 'close-circle'}
            size={22}
            color={restaurant?.isCurrentlyOpen ? Colors.success : Colors.danger}
          />
          <Text style={styles.statusText}>
            {restaurant?.isCurrentlyOpen ? t('workingHoursScreen.currentlyOpen') : t('workingHoursScreen.currentlyClosed')}
          </Text>
        </View>
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
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.gray50 },
  content: { padding: Spacing.base, paddingBottom: 100 },
  subtitle: { ...Typography.subhead, color: Colors.gray500, marginBottom: Spacing.base },
  card: { padding: 0, marginBottom: Spacing.base },
  fieldRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.base, minHeight: 56 },
  fieldBorder: { borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  fieldIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.accentLight, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  fieldContent: { flex: 1 },
  fieldLabel: { ...Typography.caption1, color: Colors.gray500, marginBottom: 4 },
  fieldInput: { ...Typography.body, color: Colors.black, padding: 0, margin: 0, minHeight: 24 },
  statusCard: { marginBottom: Spacing.xl },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  statusText: { ...Typography.body, color: Colors.black },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accent, borderRadius: BorderRadius.button, paddingVertical: Spacing.md, gap: Spacing.sm, minHeight: 48 },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { ...Typography.headline, color: Colors.white },
});
