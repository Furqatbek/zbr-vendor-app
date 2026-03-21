import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import { useStore } from '../../store';
import Card from '../../components/Card';

export default function RestaurantProfileScreen() {
  const { restaurantProfile } = useStore();

  const fields = [
    { label: 'Restaurant Name', value: restaurantProfile.name, icon: 'storefront-outline' as const },
    { label: 'Address', value: restaurantProfile.address, icon: 'location-outline' as const },
    { label: 'Phone', value: restaurantProfile.phone, icon: 'call-outline' as const },
    { label: 'Email', value: restaurantProfile.email, icon: 'mail-outline' as const },
    { label: 'Cuisine Type', value: restaurantProfile.cuisine, icon: 'restaurant-outline' as const },
    { label: 'Avg Prep Time', value: `${restaurantProfile.avgPrepTime} minutes`, icon: 'time-outline' as const },
    { label: 'Delivery Radius', value: `${restaurantProfile.deliveryRadius} km`, icon: 'navigate-outline' as const },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Ionicons name="restaurant" size={40} color={Colors.accent} />
        </View>
        <Text style={styles.restaurantName}>{restaurantProfile.name}</Text>
        <Text style={styles.cuisine}>{restaurantProfile.cuisine}</Text>
      </View>

      {/* Description */}
      <Card style={styles.descCard}>
        <Text style={styles.fieldLabel}>About</Text>
        <Text style={styles.description}>{restaurantProfile.description}</Text>
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

      <Text style={styles.hint}>Connect to backend API to enable editing</Text>
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
