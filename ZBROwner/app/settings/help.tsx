import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import Card from '../../components/Card';
import { useT } from '../../i18n';

export default function HelpCenterScreen() {
  const t = useT();

  const FAQ_ITEMS = [
    { q: t('help.faqUpdateMenu'), a: t('help.faqUpdateMenuAnswer') },
    { q: t('help.faqAcceptOrder'), a: t('help.faqAcceptOrderAnswer') },
    { q: t('help.faqContactCourier'), a: t('help.faqContactCourierAnswer') },
    { q: t('help.faqPayouts'), a: t('help.faqPayoutsAnswer') },
    { q: t('help.faqWorkingHours'), a: t('help.faqWorkingHoursAnswer') },
    { q: t('help.faqCloseRestaurant'), a: t('help.faqCloseRestaurantAnswer') },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>{t('help.getHelp')}</Text>
      <View style={styles.helpActions}>
        <TouchableOpacity style={styles.helpCard} activeOpacity={0.7}>
          <View style={[styles.helpIcon, { backgroundColor: Colors.infoLight }]}>
            <Ionicons name="chatbubbles-outline" size={24} color={Colors.info} />
          </View>
          <Text style={styles.helpLabel}>{t('help.liveChat')}</Text>
          <Text style={styles.helpDesc}>{t('help.chatWithSupport')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.helpCard} activeOpacity={0.7}>
          <View style={[styles.helpIcon, { backgroundColor: Colors.successLight }]}>
            <Ionicons name="call-outline" size={24} color={Colors.success} />
          </View>
          <Text style={styles.helpLabel}>{t('help.callUs')}</Text>
          <Text style={styles.helpDesc}>1-800-ZBR-HELP</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.helpCard} activeOpacity={0.7}>
          <View style={[styles.helpIcon, { backgroundColor: Colors.accentLight }]}>
            <Ionicons name="mail-outline" size={24} color={Colors.accent} />
          </View>
          <Text style={styles.helpLabel}>{t('help.emailUs')}</Text>
          <Text style={styles.helpDesc}>support@zbr.com</Text>
        </TouchableOpacity>
      </View>

      {/* FAQ */}
      <Text style={styles.sectionTitle}>{t('help.faq')}</Text>
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
      <Text style={styles.sectionTitle}>{t('help.guides')}</Text>
      <Card style={styles.guidesCard}>
        {[
          { label: t('help.guideGettingStarted'), icon: 'rocket-outline' as const },
          { label: t('help.guideMenuManagement'), icon: 'restaurant-outline' as const },
          { label: t('help.guideRevenue'), icon: 'trending-up-outline' as const },
          { label: t('help.guidePeakHours'), icon: 'flash-outline' as const },
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
