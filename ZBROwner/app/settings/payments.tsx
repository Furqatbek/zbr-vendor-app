import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import Card from '../../components/Card';

export default function PaymentSettingsScreen() {
  const paymentMethods = [
    { id: '1', type: 'Bank Account', detail: 'Chase ****4829', icon: 'business-outline' as const, isDefault: true },
    { id: '2', type: 'PayPal', detail: 'hello@burgerpalace.com', icon: 'logo-paypal' as const, isDefault: false },
  ];

  const payoutHistory = [
    { id: 'p1', date: 'Mar 18, 2026', amount: 1245.80, status: 'completed' },
    { id: 'p2', date: 'Mar 11, 2026', amount: 1102.35, status: 'completed' },
    { id: 'p3', date: 'Mar 4, 2026', amount: 987.60, status: 'completed' },
    { id: 'p4', date: 'Feb 25, 2026', amount: 1356.20, status: 'completed' },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Balance */}
      <Card style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceValue}>$847.50</Text>
        <Text style={styles.balanceNote}>Next payout: Mar 25, 2026</Text>
      </Card>

      {/* Payment Methods */}
      <Text style={styles.sectionTitle}>Payment Methods</Text>
      {paymentMethods.map((method) => (
        <Card key={method.id} style={styles.methodCard}>
          <View style={styles.methodRow}>
            <View style={styles.methodIcon}>
              <Ionicons name={method.icon} size={22} color={Colors.accent} />
            </View>
            <View style={styles.methodInfo}>
              <Text style={styles.methodType}>{method.type}</Text>
              <Text style={styles.methodDetail}>{method.detail}</Text>
            </View>
            {method.isDefault && (
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultText}>Default</Text>
              </View>
            )}
          </View>
        </Card>
      ))}

      {/* Payout History */}
      <Text style={styles.sectionTitle}>Recent Payouts</Text>
      <Card style={styles.historyCard}>
        {payoutHistory.map((payout, index) => (
          <View key={payout.id} style={[styles.payoutRow, index < payoutHistory.length - 1 && styles.payoutBorder]}>
            <View>
              <Text style={styles.payoutDate}>{payout.date}</Text>
              <Text style={styles.payoutStatus}>Completed</Text>
            </View>
            <Text style={styles.payoutAmount}>${payout.amount.toFixed(2)}</Text>
          </View>
        ))}
      </Card>

      {/* Tax Info */}
      <Text style={styles.sectionTitle}>Tax Information</Text>
      <Card style={styles.taxCard}>
        <View style={styles.taxRow}>
          <Ionicons name="document-text-outline" size={20} color={Colors.gray500} />
          <View style={styles.taxInfo}>
            <Text style={styles.taxLabel}>Tax ID (EIN)</Text>
            <Text style={styles.taxValue}>**-***4567</Text>
          </View>
          <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
        </View>
        <View style={[styles.taxRow, { borderTopWidth: 1, borderTopColor: Colors.gray100, paddingTop: Spacing.md, marginTop: Spacing.md }]}>
          <Ionicons name="receipt-outline" size={20} color={Colors.gray500} />
          <View style={styles.taxInfo}>
            <Text style={styles.taxLabel}>Sales Tax Rate</Text>
            <Text style={styles.taxValue}>8.875%</Text>
          </View>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.gray50 },
  content: { padding: Spacing.base, paddingBottom: 100 },
  balanceCard: { alignItems: 'center', marginBottom: Spacing.xl },
  balanceLabel: { ...Typography.footnote, color: Colors.gray500 },
  balanceValue: { ...Typography.largeTitle, color: Colors.accent, marginTop: 4 },
  balanceNote: { ...Typography.caption1, color: Colors.gray400, marginTop: Spacing.sm },
  sectionTitle: { ...Typography.headline, color: Colors.black, marginBottom: Spacing.sm, marginTop: Spacing.sm },
  methodCard: { marginBottom: Spacing.sm },
  methodRow: { flexDirection: 'row', alignItems: 'center' },
  methodIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.accentLight, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  methodInfo: { flex: 1 },
  methodType: { ...Typography.headline, color: Colors.black },
  methodDetail: { ...Typography.footnote, color: Colors.gray500, marginTop: 2 },
  defaultBadge: { backgroundColor: Colors.successLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  defaultText: { ...Typography.caption2, color: Colors.success, fontWeight: '600' },
  historyCard: { padding: 0, marginBottom: Spacing.base },
  payoutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.base },
  payoutBorder: { borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  payoutDate: { ...Typography.subhead, color: Colors.black },
  payoutStatus: { ...Typography.caption1, color: Colors.success, marginTop: 2 },
  payoutAmount: { ...Typography.headline, color: Colors.black },
  taxCard: { marginBottom: Spacing.base },
  taxRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  taxInfo: { flex: 1 },
  taxLabel: { ...Typography.caption1, color: Colors.gray500 },
  taxValue: { ...Typography.body, color: Colors.black },
});
