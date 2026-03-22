import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import Card from '../../components/Card';
import { useT } from '../../i18n';

export default function RestaurantProfileScreen() {
  const restaurant = useAuthStore((s) => s.restaurant);
  const t = useT();

  const fields = [
    { label: t('profile.restaurantName'), value: restaurant?.name ?? '', icon: 'storefront-outline' as const },
    { label: t('profile.address'), value: restaurant?.address ?? '', icon: 'location-outline' as const },
    { label: t('profile.phone'), value: restaurant?.phone ?? '', icon: 'call-outline' as const },
    { label: t('profile.email'), value: restaurant?.email ?? '', icon: 'mail-outline' as const },
    { label: t('profile.cuisineType'), value: restaurant?.cuisine ?? '', icon: 'restaurant-outline' as const },
    { label: t('profile.avgPrepTime'), value: restaurant ? t('profile.minutesUnit', { count: restaurant.avgPrepTime }) : '', icon: 'time-outline' as const },
    { label: t('profile.deliveryRadius'), value: restaurant ? t('profile.kmUnit', { count: restaurant.deliveryRadius }) : '', icon: 'navigate-outline' as const },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Ionicons name="restaurant" size={40} color={Colors.accent} />
        </View>
        <Text style={styles.restaurantName}>{restaurant?.name ?? ''}</Text>
        <Text style={styles.cuisine}>{restaurant?.cuisine ?? ''}</Text>
      </View>

      {/* Description */}
      <Card style={styles.descCard}>
        <Text style={styles.fieldLabel}>{t('profile.aboutSection')}</Text>
        <Text style={styles.description}>{restaurant?.description ?? ''}</Text>
      </Card>

      {/* Fields */}
      <Card style={styles.fieldsCard}>
        {fields.map((field, index) => (
          <View key={field.label} style={[styles.fieldRow, index < fields.length - 1 && styles.fieldBorder]}>
            <View style={styles.fieldIcon}>
              <Ionicons name={field.icon} size={20} color={Colors.accent} />
            </View>
            <View style={styles.fieldContent}>
              <Text style={styles.fieldLabel}>{field.label}</Text>
              <Text style={styles.fieldValue}>{field.value}</Text>
            </View>
          </View>
        ))}
      </Card>

      <Text style={styles.hint}>{t('profile.connectHint')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.gray50 },
  content: { padding: Spacing.base, paddingBottom: 100 },
  avatarSection: { alignItems: 'center', marginBottom: Spacing.xl },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.accentLight, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
  restaurantName: { ...Typography.title2, color: Colors.black },
  cuisine: { ...Typography.subhead, color: Colors.gray500, marginTop: 4 },
  descCard: { marginBottom: Spacing.base },
  description: { ...Typography.body, color: Colors.gray700, lineHeight: 24 },
  fieldsCard: { padding: 0, marginBottom: Spacing.base },
  fieldRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.base, minHeight: 56 },
  fieldBorder: { borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  fieldIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.accentLight, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  fieldContent: { flex: 1 },
  fieldLabel: { ...Typography.caption1, color: Colors.gray500, marginBottom: 2 },
  fieldValue: { ...Typography.body, color: Colors.black },
  hint: { ...Typography.footnote, color: Colors.gray400, textAlign: 'center', marginTop: Spacing.md },
});
