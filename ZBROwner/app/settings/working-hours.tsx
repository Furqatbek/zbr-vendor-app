import React from 'react';
import { View, Text, StyleSheet, FlatList, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import { useStore } from '../../store';
import Card from '../../components/Card';
import { useT } from '../../i18n';

const DAY_KEYS: Record<string, string> = {
  Monday: 'workingHoursScreen.monday',
  Tuesday: 'workingHoursScreen.tuesday',
  Wednesday: 'workingHoursScreen.wednesday',
  Thursday: 'workingHoursScreen.thursday',
  Friday: 'workingHoursScreen.friday',
  Saturday: 'workingHoursScreen.saturday',
  Sunday: 'workingHoursScreen.sunday',
};

export default function WorkingHoursScreen() {
  const { workingHours, toggleWorkingDay } = useStore();
  const t = useT();

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  return (
    <View style={styles.screen}>
      <FlatList
        data={workingHours}
        keyExtractor={(item) => item.day}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <Text style={styles.subtitle}>{t('workingHoursScreen.subtitle')}</Text>
        }
        renderItem={({ item, index }) => {
          const isToday = item.day === today;
          return (
            <Card style={{ ...styles.dayCard, ...(isToday ? styles.todayCard : {}) }}>
              <View style={styles.dayRow}>
                <View style={styles.dayInfo}>
                  <View style={styles.dayHeader}>
                    <Text style={[styles.dayName, isToday && styles.todayText]}>
                      {DAY_KEYS[item.day] ? t(DAY_KEYS[item.day] as any) : item.day}
                    </Text>
                    {isToday && (
                      <View style={styles.todayBadge}>
                        <Text style={styles.todayBadgeText}>{t('workingHoursScreen.today')}</Text>
                      </View>
                    )}
                  </View>
                  {item.isOpen ? (
                    <Text style={styles.hours}>{item.openTime} — {item.closeTime}</Text>
                  ) : (
                    <Text style={styles.closedText}>{t('workingHoursScreen.closed')}</Text>
                  )}
                </View>
                <Switch
                  value={item.isOpen}
                  onValueChange={() => toggleWorkingDay(item.day)}
                  trackColor={{ false: Colors.gray300, true: Colors.accentLight }}
                  thumbColor={item.isOpen ? Colors.accent : Colors.gray400}
                />
              </View>
            </Card>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.gray50 },
  content: { padding: Spacing.base, paddingBottom: 100 },
  subtitle: { ...Typography.subhead, color: Colors.gray500, marginBottom: Spacing.base },
  dayCard: { marginBottom: Spacing.sm },
  todayCard: { borderColor: Colors.accent, borderWidth: 1.5 },
  dayRow: { flexDirection: 'row', alignItems: 'center' },
  dayInfo: { flex: 1 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dayName: { ...Typography.headline, color: Colors.black },
  todayText: { color: Colors.accent },
  todayBadge: { backgroundColor: Colors.accentLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  todayBadgeText: { ...Typography.caption2, color: Colors.accent, fontWeight: '600' },
  hours: { ...Typography.subhead, color: Colors.gray600, marginTop: 4 },
  closedText: { ...Typography.subhead, color: Colors.danger, marginTop: 4 },
});
