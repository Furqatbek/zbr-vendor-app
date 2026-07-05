import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, BorderRadius, Typography } from '../constants/theme';
import { useT } from '../i18n';
import type { TranslationKey } from '../i18n';
import type { OrderStatus } from '../types';

const statusColors: Record<OrderStatus, { bg: string; text: string }> = {
  created: { bg: Colors.infoLight, text: Colors.info },
  accepted: { bg: Colors.infoLight, text: Colors.info },
  preparing: { bg: Colors.warningLight, text: Colors.warning },
  ready: { bg: Colors.successLight, text: Colors.success },
  picked_up: { bg: Colors.accentLight, text: Colors.accent },
  in_transit: { bg: Colors.accentLight, text: Colors.accent },
  delivered: { bg: Colors.successLight, text: Colors.success },
  completed: { bg: Colors.successLight, text: Colors.success },
  cancelled: { bg: Colors.dangerLight, text: Colors.danger },
  refunded: { bg: Colors.dangerLight, text: Colors.danger },
};

const statusKeys: Record<OrderStatus, TranslationKey> = {
  created: 'statusBadge.new',
  accepted: 'statusBadge.accepted',
  preparing: 'statusBadge.preparing',
  ready: 'statusBadge.ready',
  picked_up: 'statusBadge.pickedUp',
  in_transit: 'statusBadge.inTransit',
  delivered: 'statusBadge.delivered',
  completed: 'statusBadge.completed',
  cancelled: 'statusBadge.cancelled',
  refunded: 'statusBadge.refunded',
};

interface Props {
  status: OrderStatus;
}

export default function StatusBadge({ status }: Props) {
  const t = useT();
  const colors = statusColors[status] ?? { bg: Colors.gray100, text: Colors.gray500 };
  // status may be an out-of-union string at runtime (normalizeStatus passes
  // unknown backend statuses through), so keep the truthy guard.
  const key = statusKeys[status];
  const label = key ? t(key) : status;

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.text, { color: colors.text }]}>{label}</Text>
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
