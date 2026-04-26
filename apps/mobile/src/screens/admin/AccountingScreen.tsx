import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput, Alert,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';

// Alias to local lowercase names for conciseness within this file
const colors  = { ...Colors, successLight: '#d4edda', warningLight: '#fff3cd', errorLight: '#f8d7da' };
const spacing = Spacing;
const typography = { ...Typography, body: Typography.body1 };
import { apiClient } from '../../services/api/apiClient';

// ── Types ──────────────────────────────────────────────────────────────────
interface LedgerEntry {
  id: string;
  type: 'Income' | 'Expense';
  category: string;
  description: string;
  amountPaise: number;
  entryDate: string;
  status: 'Approved' | 'PendingApproval' | 'Rejected';
  receiptUrl?: string;
  createdAt: string;
}

interface MonthlyReport {
  month: number;
  year: number;
  totalIncomePaise: number;
  totalExpensePaise: number;
  netPaise: number;
  incomeByCategory: { category: string; amountPaise: number; count: number }[];
  expenseByCategory: { category: string; amountPaise: number; count: number }[];
  pendingApprovals: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────
const paise2Rs = (p: number) => `₹${(p / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const EXPENSE_CATEGORIES = [
  'Housekeeping', 'Security', 'Maintenance', 'Electricity', 'Water',
  'Lift Maintenance', 'Generator', 'Landscaping', 'Painting', 'Plumbing',
  'Pest Control', 'Admin', 'Legal', 'Audit', 'Other',
];

const INCOME_CATEGORIES = [
  'Maintenance', 'Parking Fee', 'Clubhouse Booking', 'Late Fee',
  'NOC Fee', 'Transfer Fee', 'Interest', 'Other',
];

// ── Main Screen ────────────────────────────────────────────────────────────
export default function AccountingScreen() {
  const [report, setReport]     = useState<MonthlyReport | null>(null);
  const [entries, setEntries]   = useState<LedgerEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab]           = useState<'report' | 'entries' | 'pending'>('report');
  const [showAdd, setShowAdd]   = useState(false);
  const [newEntry, setNewEntry] = useState({
    type: 'Expense' as 'Income' | 'Expense',
    category: 'Maintenance',
    description: '',
    amountPaise: '',
    entryDate: new Date().toISOString().split('T')[0],
  });

  const load = useCallback(async () => {
    try {
      const [rep, ent] = await Promise.all([
        apiClient.get<MonthlyReport>('/accounting/report'),
        apiClient.get<{ items: LedgerEntry[] }>('/accounting/entries?pageSize=100'),
      ]);
      setReport(rep);
      setEntries(ent.items);
    } catch (e) {
      Alert.alert('Error', 'Failed to load accounting data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const addEntry = async () => {
    if (!newEntry.description || !newEntry.amountPaise) {
      Alert.alert('Validation', 'Description and amount are required.');
      return;
    }
    try {
      await apiClient.post('/accounting/entries', {
        type: newEntry.type,
        category: newEntry.category,
        description: newEntry.description,
        amountPaise: Math.round(parseFloat(newEntry.amountPaise) * 100),
        entryDate: newEntry.entryDate,
      });
      setShowAdd(false);
      load();
      Alert.alert('Success', 'Entry posted successfully.');
    } catch {
      Alert.alert('Error', 'Failed to post entry.');
    }
  };

  const approveEntry = async (id: string) => {
    await apiClient.post(`/accounting/entries/${id}/approve`, {});
    load();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const pendingEntries = entries.filter(e => e.status === 'PendingApproval');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Accounting</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={styles.addBtnText}>+ Entry</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['report', 'entries', 'pending'] as const).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.activeTab]}
            onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.activeTabText]}>
              {t === 'report' ? 'P&L' : t === 'entries' ? 'Ledger' : `Pending${pendingEntries.length ? ` (${pendingEntries.length})` : ''}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {tab === 'report' && report && (
          <View style={styles.section}>
            {/* Summary cards */}
            <View style={styles.summaryRow}>
              <View style={[styles.card, { borderLeftColor: colors.success }]}>
                <Text style={styles.cardLabel}>Income</Text>
                <Text style={[styles.cardValue, { color: colors.success }]}>
                  {paise2Rs(report.totalIncomePaise)}
                </Text>
              </View>
              <View style={[styles.card, { borderLeftColor: colors.error }]}>
                <Text style={styles.cardLabel}>Expenses</Text>
                <Text style={[styles.cardValue, { color: colors.error }]}>
                  {paise2Rs(report.totalExpensePaise)}
                </Text>
              </View>
            </View>
            <View style={[styles.netCard, {
              borderLeftColor: report.netPaise >= 0 ? colors.success : colors.error,
            }]}>
              <Text style={styles.netLabel}>Net Balance</Text>
              <Text style={[styles.netValue, {
                color: report.netPaise >= 0 ? colors.success : colors.error,
              }]}>
                {paise2Rs(Math.abs(report.netPaise))}
                {report.netPaise < 0 ? ' deficit' : ' surplus'}
              </Text>
            </View>

            {/* Expense breakdown */}
            <Text style={styles.sectionTitle}>Expense Breakdown</Text>
            {report.expenseByCategory.map(c => (
              <View key={c.category} style={styles.catRow}>
                <Text style={styles.catName}>{c.category}</Text>
                <Text style={styles.catAmount}>{paise2Rs(c.amountPaise)}</Text>
              </View>
            ))}
          </View>
        )}

        {tab === 'entries' && (
          <View style={styles.section}>
            {entries.map(e => (
              <View key={e.id} style={styles.entryRow}>
                <View style={styles.entryLeft}>
                  <Text style={styles.entryCategory}>{e.category}</Text>
                  <Text style={styles.entryDesc}>{e.description}</Text>
                  <Text style={styles.entryDate}>{e.entryDate}</Text>
                </View>
                <View style={styles.entryRight}>
                  <Text style={[styles.entryAmount, {
                    color: e.type === 'Income' ? colors.success : colors.error,
                  }]}>
                    {e.type === 'Income' ? '+' : '-'}{paise2Rs(e.amountPaise)}
                  </Text>
                  <View style={[styles.badge, {
                    backgroundColor: e.status === 'Approved' ? colors.successLight
                      : e.status === 'PendingApproval' ? colors.warningLight : colors.errorLight,
                  }]}>
                    <Text style={styles.badgeText}>{e.status === 'PendingApproval' ? 'Pending' : e.status}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {tab === 'pending' && (
          <View style={styles.section}>
            {pendingEntries.length === 0 && (
              <Text style={styles.emptyText}>No pending approvals</Text>
            )}
            {pendingEntries.map(e => (
              <View key={e.id} style={styles.pendingCard}>
                <Text style={styles.entryCategory}>{e.category} — {e.description}</Text>
                <Text style={[styles.entryAmount, { color: colors.error }]}>
                  {paise2Rs(e.amountPaise)}
                </Text>
                <TouchableOpacity style={styles.approveBtn} onPress={() => approveEntry(e.id)}>
                  <Text style={styles.approveBtnText}>Approve</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add Entry Modal */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Post Ledger Entry</Text>
          <View style={styles.typeToggle}>
            {(['Expense', 'Income'] as const).map(t => (
              <TouchableOpacity key={t}
                style={[styles.typeBtn, newEntry.type === t && styles.typeBtnActive]}
                onPress={() => setNewEntry(p => ({ ...p, type: t,
                  category: t === 'Income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0] }))}>
                <Text style={[styles.typeBtnText, newEntry.type === t && { color: '#fff' }]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.fieldLabel}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
            {(newEntry.type === 'Income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => (
              <TouchableOpacity key={c}
                style={[styles.catChip, newEntry.category === c && styles.catChipActive]}
                onPress={() => setNewEntry(p => ({ ...p, category: c }))}>
                <Text style={[styles.catChipText, newEntry.category === c && { color: '#fff' }]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput style={styles.input} value={newEntry.description}
            onChangeText={v => setNewEntry(p => ({ ...p, description: v }))}
            placeholder="e.g. Housekeeping wages April 2026" />
          <Text style={styles.fieldLabel}>Amount (₹)</Text>
          <TextInput style={styles.input} value={newEntry.amountPaise}
            onChangeText={v => setNewEntry(p => ({ ...p, amountPaise: v }))}
            keyboardType="decimal-pad" placeholder="e.g. 12500" />
          <Text style={styles.fieldLabel}>Date (YYYY-MM-DD)</Text>
          <TextInput style={styles.input} value={newEntry.entryDate}
            onChangeText={v => setNewEntry(p => ({ ...p, entryDate: v }))} />
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAdd(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitBtn} onPress={addEntry}>
              <Text style={styles.submitBtnText}>Post Entry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: colors.background },
  center:        { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                   padding: spacing.md, backgroundColor: colors.surface,
                   borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle:   { ...typography.h2 },
  addBtn:        { backgroundColor: colors.primary, paddingHorizontal: spacing.md,
                   paddingVertical: spacing.xs, borderRadius: 8 },
  addBtnText:    { color: '#fff', fontWeight: '600' },
  tabs:          { flexDirection: 'row', backgroundColor: colors.surface,
                   borderBottomWidth: 1, borderBottomColor: colors.border },
  tab:           { flex: 1, paddingVertical: spacing.sm, alignItems: 'center' },
  activeTab:     { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabText:       { ...typography.body, color: colors.textSecondary },
  activeTabText: { color: colors.primary, fontWeight: '600' },
  section:       { padding: spacing.md, gap: spacing.sm },
  summaryRow:    { flexDirection: 'row', gap: spacing.sm },
  card:          { flex: 1, backgroundColor: colors.surface, padding: spacing.md,
                   borderRadius: 8, borderLeftWidth: 4 },
  cardLabel:     { ...typography.caption, color: colors.textSecondary },
  cardValue:     { ...typography.h2, marginTop: spacing.xs },
  netCard:       { backgroundColor: colors.surface, padding: spacing.md,
                   borderRadius: 8, borderLeftWidth: 4, marginTop: spacing.xs },
  netLabel:      { ...typography.caption, color: colors.textSecondary },
  netValue:      { ...typography.h2, marginTop: spacing.xs },
  sectionTitle:  { ...typography.h3, marginTop: spacing.md, marginBottom: spacing.xs },
  catRow:        { flexDirection: 'row', justifyContent: 'space-between',
                   paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  catName:       { ...typography.body },
  catAmount:     { ...typography.body, fontWeight: '600' },
  entryRow:      { flexDirection: 'row', justifyContent: 'space-between',
                   backgroundColor: colors.surface, padding: spacing.sm, borderRadius: 8 },
  entryLeft:     { flex: 1 },
  entryRight:    { alignItems: 'flex-end', gap: spacing.xs },
  entryCategory: { ...typography.caption, color: colors.textSecondary },
  entryDesc:     { ...typography.body },
  entryDate:     { ...typography.caption, color: colors.textSecondary },
  entryAmount:   { ...typography.body, fontWeight: '700' },
  badge:         { paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: 4 },
  badgeText:     { ...typography.caption, fontWeight: '600' },
  emptyText:     { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl },
  pendingCard:   { backgroundColor: colors.surface, padding: spacing.md, borderRadius: 8, gap: spacing.xs },
  approveBtn:    { backgroundColor: colors.success, padding: spacing.sm, borderRadius: 8, alignItems: 'center' },
  approveBtnText:{ color: '#fff', fontWeight: '600' },
  modal:         { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  modalTitle:    { ...typography.h2, marginBottom: spacing.md },
  typeToggle:    { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  typeBtn:       { flex: 1, padding: spacing.sm, borderRadius: 8, borderWidth: 1,
                   borderColor: colors.border, alignItems: 'center' },
  typeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeBtnText:   { ...typography.body, fontWeight: '600' },
  fieldLabel:    { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs },
  catScroll:     { marginBottom: spacing.md },
  catChip:       { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: 16,
                   borderWidth: 1, borderColor: colors.border, marginRight: spacing.xs, marginBottom: spacing.xs },
  catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catChipText:   { ...typography.caption },
  input:         { borderWidth: 1, borderColor: colors.border, borderRadius: 8,
                   padding: spacing.sm, ...typography.body, marginBottom: spacing.md,
                   backgroundColor: colors.surface },
  modalActions:  { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  cancelBtn:     { flex: 1, padding: spacing.md, borderRadius: 8, borderWidth: 1,
                   borderColor: colors.border, alignItems: 'center' },
  cancelBtnText: { ...typography.body },
  submitBtn:     { flex: 1, padding: spacing.md, borderRadius: 8,
                   backgroundColor: colors.primary, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: '600', ...typography.body },
  successLight:  colors.successLight,
  warningLight:  colors.warningLight,
  errorLight:    colors.errorLight,
});
