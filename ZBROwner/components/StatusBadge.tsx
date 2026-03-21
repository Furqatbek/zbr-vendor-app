import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, BorderRadius, Typography } from '../constants/theme';
import type { OrderStatus } from '../types';

const statusConfig: Record<OrderStatus, { label: string; bg: string; text: string }> = {
  received: { label: 'New', bg: Colors.infoLight, text: Colors.info },
  confirmed: { label: 'Confirmed', bg: Colors.infoLight, text: Colors.info },
  preparing: { label: 'Preparing', bg: Colors.warningLight, text: Colors.warning },
  ready: { label: 'Ready', bg: Colors.successLight, text: Colors.success },
  picked_up: { label: 'Picked Up', bg: Colors.accentLight, text: Colors.accent },
  delivered: { label: 'Delivered', bg: Colors.successLight, text: Colors.success },
  cancelled: { label: 'Cancelled', bg: Colors.dangerLight, text: Colors.danger },
};

interface Props {
  status: OrderStatus;
}

export default function StatusBadge({ status }: Props) {
  const config = statusConfig[status];
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.text, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.chip,
  },
  text: {
    ...Typography.caption1,
    fontWeight: '600',
  },
});
