import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { Colors }    from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Radius } from '../../theme/spacing';

const QUICK_ACTIONS = [
  { icon: '💰', label: 'Pay Bill',      route: '/(app)/bills'      },
  { icon: '🚪', label: 'Approve Visitor', route: '/(app)/visitors'  },
  { icon: '🔧', label: 'Complaint',     route: '/(app)/complaints' },
  { icon: '📢', label: 'Notices',       route: '/(app)/notices'    },
  { icon: '🏊', label: 'Book Facility', route: '/(app)/facilities' },
  { icon: '🚗', label: 'Parking',       route: '/(app)/parking'    },
] as const;

export default function HomeScreen() {
  const name = useAuthStore((s) => s.name);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good morning 👋</Text>
          <Text style={styles.name}>{name ?? 'Resident'}</Text>
        </View>
        <TouchableOpacity style={styles.notifBtn} onPress={() => router.push('/(app)/notifications')}>
          <Text style={styles.notifIcon}>🔔</Text>
        </TouchableOpacity>
      </View>

      {/* Pending Bill Banner */}
      <TouchableOpacity style={styles.billBanner} onPress={() => router.push('/(app)/bills')}>
        <View>
          <Text style={styles.billLabel}>Maintenance Due</Text>
          <Text style={styles.billAmount}>₹3,500</Text>
          <Text style={styles.billDue}>Due: 10 May 2026</Text>
        </View>
        <Text style={styles.payNow}>PAY NOW →</Text>
      </TouchableOpacity>

      {/* Quick Actions Grid */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.grid}>
        {QUICK_ACTIONS.map((action) => (
          <TouchableOpacity
            key={action.label}
            style={styles.gridItem}
            onPress={() => router.push(action.route as any)}
            activeOpacity={0.7}>
            <Text style={styles.gridIcon}>{action.icon}</Text>
            <Text style={styles.gridLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Recent Visitors */}
      <Text style={styles.sectionTitle}>Pending Approvals</Text>
      <View style={styles.card}>
        <Text style={styles.emptyState}>No pending visitor approvals</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: Colors.background },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                   padding: Spacing.md, paddingTop: Spacing.xl, backgroundColor: Colors.primary },
  greeting:      { ...Typography.body2, color: Colors.textOnPrimary + 'cc' },
  name:          { ...Typography.h3, color: Colors.textOnPrimary },
  notifBtn:      { width: 44, height: 44, borderRadius: Radius.full,
                   backgroundColor: '#ffffff22', alignItems: 'center', justifyContent: 'center' },
  notifIcon:     { fontSize: 20 },
  billBanner:    { margin: Spacing.md, backgroundColor: Colors.secondary, borderRadius: Radius.lg,
                   padding: Spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  billLabel:     { ...Typography.caption, color: Colors.textOnPrimary + 'cc' },
  billAmount:    { ...Typography.h2, color: Colors.textOnPrimary },
  billDue:       { ...Typography.caption, color: Colors.textOnPrimary + 'cc' },
  payNow:        { ...Typography.body2, fontWeight: '700', color: Colors.textOnPrimary },
  sectionTitle:  { ...Typography.h4, color: Colors.textPrimary, margin: Spacing.md, marginBottom: Spacing.sm },
  grid:          { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.sm },
  gridItem:      { width: '33.33%', padding: Spacing.xs, alignItems: 'center' },
  gridIcon:      { fontSize: 32, marginBottom: Spacing.xs },
  gridLabel:     { ...Typography.caption, color: Colors.textPrimary, textAlign: 'center', fontWeight: '600' },
  card:          { margin: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.md,
                   padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  emptyState:    { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center', paddingVertical: Spacing.md },
});
