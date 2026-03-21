import React from 'react';
import { View, Text, StyleSheet, FlatList, Switch, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import { useStore } from '../../store';
import Card from '../../components/Card';

const ROLE_COLORS = {
  owner: Colors.accent,
  manager: Colors.info,
  staff: Colors.gray500,
};

const ROLE_LABELS = {
  owner: 'Owner',
  manager: 'Manager',
  staff: 'Staff',
};

export default function StaffAccountsScreen() {
  const { staffMembers, toggleStaffActive } = useStore();

  const activeCount = staffMembers.filter((s) => s.isActive).length;

  return (
    <View style={styles.screen}>
      <FlatList
        data={staffMembers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Card style={styles.statsCard}>
              <View style={styles.statRow}>
                <View style={styles.stat}>
                  <Text style={styles.statNum}>{staffMembers.length}</Text>
                  <Text style={styles.statLabel}>Total</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.stat}>
                  <Text style={[styles.statNum, { color: Colors.success }]}>{activeCount}</Text>
                  <Text style={styles.statLabel}>Active</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.stat}>
                  <Text style={[styles.statNum, { color: Colors.gray400 }]}>{staffMembers.length - activeCount}</Text>
                  <Text style={styles.statLabel}>Inactive</Text>
                </View>
              </View>
            </Card>
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.staffCard}>
            <View style={styles.staffRow}>
              <View style={[styles.avatarCircle, { backgroundColor: item.isActive ? Colors.accentLight : Colors.gray100 }]}>
                <Text style={[styles.avatarText, { color: item.isActive ? Colors.accent : Colors.gray400 }]}>
                  {item.name.split(' ').map((n) => n[0]).join('')}
                </Text>
              </View>
              <View style={styles.staffInfo}>
                <Text style={styles.staffName}>{item.name}</Text>
                <Text style={styles.staffEmail}>{item.email}</Text>
                <View style={[styles.roleBadge, { backgroundColor: `${ROLE_COLORS[item.role]}18` }]}>
                  <Text style={[styles.roleText, { color: ROLE_COLORS[item.role] }]}>
                    {ROLE_LABELS[item.role]}
                  </Text>
                </View>
              </View>
              <Switch
                value={item.isActive}
                onValueChange={() => toggleStaffActive(item.id)}
                trackColor={{ false: Colors.gray300, true: Colors.accentLight }}
                thumbColor={item.isActive ? Colors.accent : Colors.gray400}
                disabled={item.role === 'owner'}
              />
            </View>
          </Card>
        )}
        ListFooterComponent={
          <TouchableOpacity style={styles.addButton} activeOpacity={0.7}>
            <Ionicons name="person-add-outline" size={20} color={Colors.accent} />
            <Text style={styles.addButtonText}>Invite Staff Member</Text>
          </TouchableOpacity>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.gray50 },
  content: { padding: Spacing.base, paddingBottom: 100 },
  header: { marginBottom: Spacing.sm },
  statsCard: { marginBottom: Spacing.sm },
  statRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  stat: { flex: 1, alignItems: 'center' },
  statNum: { ...Typography.title2, color: Colors.black },
  statLabel: { ...Typography.caption1, color: Colors.gray500, marginTop: 2 },
  divider: { width: 1, height: 32, backgroundColor: Colors.gray200 },
  staffCard: { marginBottom: Spacing.sm },
  staffRow: { flexDirection: 'row', alignItems: 'center' },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  avatarText: { ...Typography.headline },
  staffInfo: { flex: 1 },
  staffName: { ...Typography.headline, color: Colors.black },
  staffEmail: { ...Typography.caption1, color: Colors.gray500, marginTop: 2 },
  roleBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
  roleText: { ...Typography.caption2, fontWeight: '600' },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.base, marginTop: Spacing.sm, gap: Spacing.sm, minHeight: 48 },
  addButtonText: { ...Typography.headline, color: Colors.accent },
});
