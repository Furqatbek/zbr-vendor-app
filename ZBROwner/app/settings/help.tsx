import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import Card from '../../components/Card';

const FAQ_ITEMS = [
  { q: 'How do I update my menu?', a: 'Go to the Menu tab, tap a category, then edit items individually. You can toggle stock status, change prices, and update descriptions.' },
  { q: 'How do I accept an order?', a: 'On the Orders tab, slide the order card to the right to accept. Slide left to decline with a reason.' },
  { q: 'How do I contact a courier?', a: 'Open the order detail page and use the Quick Contact section at the bottom to call or message the courier.' },
  { q: 'When do I receive payouts?', a: 'Payouts are processed weekly on Tuesdays. Go to Payment Settings to view your payout history and schedule.' },
  { q: 'How do I change working hours?', a: 'Go to More > Working Hours. Toggle days on/off and set opening and closing times.' },
  { q: 'Can I temporarily close my restaurant?', a: 'Yes! Use the Open/Closed toggle on the home screen or in the More tab to temporarily pause orders.' },
];

export default function HelpCenterScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Get Help</Text>
      <View style={styles.helpActions}>
        <TouchableOpacity style={styles.helpCard} activeOpacity={0.7}>
          <View style={[styles.helpIcon, { backgroundColor: Colors.infoLight }]}>
            <Ionicons name="chatbubbles-outline" size={24} color={Colors.info} />
          </View>
          <Text style={styles.helpLabel}>Live Chat</Text>
          <Text style={styles.helpDesc}>Chat with support</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.helpCard} activeOpacity={0.7}>
          <View style={[styles.helpIcon, { backgroundColor: Colors.successLight }]}>
            <Ionicons name="call-outline" size={24} color={Colors.success} />
          </View>
          <Text style={styles.helpLabel}>Call Us</Text>
          <Text style={styles.helpDesc}>1-800-ZBR-HELP</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.helpCard} activeOpacity={0.7}>
          <View style={[styles.helpIcon, { backgroundColor: Colors.accentLight }]}>
            <Ionicons name="mail-outline" size={24} color={Colors.accent} />
          </View>
          <Text style={styles.helpLabel}>Email</Text>
          <Text style={styles.helpDesc}>support@zbr.com</Text>
        </TouchableOpacity>
      </View>

      {/* FAQ */}
      <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
      {FAQ_ITEMS.map((item, index) => (
        <Card key={index} style={styles.faqCard}>
          <View style={styles.faqHeader}>
            <Ionicons name="help-circle" size={20} color={Colors.accent} />
            <Text style={styles.faqQuestion}>{item.q}</Text>
          </View>
          <Text style={styles.faqAnswer}>{item.a}</Text>
        </Card>
      ))}

      {/* Guides */}
      <Text style={styles.sectionTitle}>Guides</Text>
      <Card style={styles.guidesCard}>
        {[
          { label: 'Getting Started Guide', icon: 'rocket-outline' as const },
          { label: 'Menu Management Tips', icon: 'restaurant-outline' as const },
          { label: 'Maximizing Your Revenue', icon: 'trending-up-outline' as const },
          { label: 'Handling Peak Hours', icon: 'flash-outline' as const },
        ].map((guide, index, arr) => (
          <TouchableOpacity key={guide.label} style={[styles.guideRow, index < arr.length - 1 && styles.guideBorder]} activeOpacity={0.7}>
            <Ionicons name={guide.icon} size={20} color={Colors.accent} />
            <Text style={styles.guideLabel}>{guide.label}</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.gray400} />
          </TouchableOpacity>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.gray50 },
  content: { padding: Spacing.base, paddingBottom: 100 },
  sectionTitle: { ...Typography.headline, color: Colors.black, marginBottom: Spacing.sm, marginTop: Spacing.base },
  helpActions: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  helpCard: { flex: 1, backgroundColor: Colors.white, borderRadius: BorderRadius.card, padding: Spacing.base, alignItems: 'center', borderWidth: 1, borderColor: Colors.gray200 },
  helpIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm },
  helpLabel: { ...Typography.subhead, fontWeight: '600', color: Colors.black },
  helpDesc: { ...Typography.caption1, color: Colors.gray500, marginTop: 2, textAlign: 'center' },
  faqCard: { marginBottom: Spacing.sm },
  faqHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  faqQuestion: { ...Typography.subhead, fontWeight: '600', color: Colors.black, flex: 1 },
  faqAnswer: { ...Typography.subhead, color: Colors.gray600, marginTop: Spacing.sm, marginLeft: 28, lineHeight: 22 },
  guidesCard: { padding: 0 },
  guideRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.base, gap: Spacing.md, minHeight: 48 },
  guideBorder: { borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  guideLabel: { ...Typography.body, color: Colors.black, flex: 1 },
});
