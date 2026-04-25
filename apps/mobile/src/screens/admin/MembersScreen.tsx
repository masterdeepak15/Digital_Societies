import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput, Alert,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';
import { apiClient } from '../../services/api/apiClient';

// ── Types ──────────────────────────────────────────────────────────────────
interface Member {
  userId: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  flatId?: string;
  flatNumber?: string;
  wing?: string;
  memberType?: string;  // owner | tenant | family
  joinedAt: string;
  isActive: boolean;
}

type RoleFilter = 'all' | 'admin' | 'resident' | 'guard' | 'staff';

// ── Helpers ────────────────────────────────────────────────────────────────
const roleBadgeColor = (role: string): string => {
  switch (role) {
    case 'admin':    return Colors.roleAdmin;
    case 'resident': return Colors.roleResident;
    case 'guard':    return Colors.roleGuard;
    case 'staff':    return Colors.roleStaff;
    default:         return Colors.textSecondary;
  }
};

const MEMBER_TYPES = ['family', 'tenant', 'owner'];

// ── Main Screen ────────────────────────────────────────────────────────────
export default function MembersScreen() {
  const [members, setMembers]       = useState<Member[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]         = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [showAdd, setShowAdd]       = useState(false);
  const [expandedFlat, setExpandedFlat] = useState<string | null>(null);
  const [newMember, setNewMember]   = useState({
    flatNumber: '',
    wing: '',
    memberType: 'family',
    name: '',
    phone: '',
    email: '',
  });

  const load = useCallback(async () => {
    try {
      const result = await apiClient.get<{ items: Member[] }>(
        `/members?pageSize=200&role=${roleFilter === 'all' ? '' : roleFilter}`
      );
      setMembers(result.items);
    } catch {
      Alert.alert('Error', 'Failed to load members.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [roleFilter]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const addFamilyMember = async () => {
    if (!newMember.flatNumber || !newMember.name || !newMember.phone) {
      Alert.alert('Validation', 'Flat number, name and phone are required.');
      return;
    }
    try {
      await apiClient.post('/members/family', {
        flatNumber: newMember.flatNumber,
        wing: newMember.wing || undefined,
        memberType: newMember.memberType,
        name: newMember.name,
        phone: newMember.phone,
        email: newMember.email || undefined,
      });
      setShowAdd(false);
      setNewMember({ flatNumber: '', wing: '', memberType: 'family', name: '', phone: '', email: '' });
      load();
      Alert.alert('Success', 'Family member added successfully.');
    } catch {
      Alert.alert('Error', 'Failed to add family member.');
    }
  };

  const removeMember = (userId: string, memberName: string) => {
    Alert.alert('Remove Member', `Remove ${memberName} from the society?`, [
      { text: 'Cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.post(`/members/${userId}/remove`, {});
            load();
          } catch {
            Alert.alert('Error', 'Failed to remove member.');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // Filter by search
  const filtered = members.filter(m => {
    const q = search.toLowerCase();
    return !q ||
      m.name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      (m.flatNumber ?? '').toLowerCase().includes(q) ||
      (m.wing ?? '').toLowerCase().includes(q);
  });

  // Group residents by flat
  const residentsByFlat = new Map<string, Member[]>();
  const nonResidents: Member[] = [];
  filtered.forEach(m => {
    if (m.role === 'resident' && m.flatNumber) {
      const key = `${m.wing ?? ''}${m.flatNumber}`;
      if (!residentsByFlat.has(key)) residentsByFlat.set(key, []);
      residentsByFlat.get(key)!.push(m);
    } else {
      nonResidents.push(m);
    }
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Members</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={styles.addBtnText}>+ Family</Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, flat, email…"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Role filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {(['all', 'admin', 'resident', 'guard', 'staff'] as RoleFilter[]).map(r => (
          <TouchableOpacity key={r}
            style={[styles.filterChip, roleFilter === r && styles.filterChipActive]}
            onPress={() => setRoleFilter(r)}>
            <Text style={[styles.filterChipText, roleFilter === r && styles.filterChipTextActive]}>
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Summary bar */}
      <View style={styles.summaryBar}>
        <Text style={styles.summaryText}>{filtered.length} member{filtered.length !== 1 ? 's' : ''}</Text>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        style={{ flex: 1 }}>

        {/* Residents grouped by flat */}
        {roleFilter === 'all' || roleFilter === 'resident' ? (
          Array.from(residentsByFlat.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([key, flatMembers]) => {
            const rep = flatMembers[0];
            const isExpanded = expandedFlat === key;
            return (
              <View key={key} style={styles.flatGroup}>
                <TouchableOpacity style={styles.flatHeader}
                  onPress={() => setExpandedFlat(isExpanded ? null : key)}>
                  <View>
                    <Text style={styles.flatNumber}>
                      {rep.wing ? `Wing ${rep.wing} · ` : ''}Flat {rep.flatNumber}
                    </Text>
                    <Text style={styles.flatMeta}>{flatMembers.length} member{flatMembers.length !== 1 ? 's' : ''}</Text>
                  </View>
                  <Text style={styles.chevron}>{isExpanded ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {isExpanded && flatMembers.map(m => (
                  <View key={m.userId} style={styles.memberRow}>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{m.name}</Text>
                      <Text style={styles.memberSub}>{m.email}</Text>
                      {m.phone && <Text style={styles.memberSub}>{m.phone}</Text>}
                    </View>
                    <View style={styles.memberRight}>
                      <View style={[styles.badge, { backgroundColor: roleBadgeColor(m.role) }]}>
                        <Text style={styles.badgeText}>{m.memberType ?? m.role}</Text>
                      </View>
                      <TouchableOpacity onPress={() => removeMember(m.userId, m.name)}>
                        <Text style={styles.removeText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            );
          })
        ) : null}

        {/* Non-residents (admin, guard, staff) */}
        {nonResidents.map(m => (
          <View key={m.userId} style={styles.memberCard}>
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{m.name}</Text>
              <Text style={styles.memberSub}>{m.email}</Text>
              {m.phone && <Text style={styles.memberSub}>{m.phone}</Text>}
            </View>
            <View style={styles.memberRight}>
              <View style={[styles.badge, { backgroundColor: roleBadgeColor(m.role) }]}>
                <Text style={styles.badgeText}>{m.role}</Text>
              </View>
              <TouchableOpacity onPress={() => removeMember(m.userId, m.name)}>
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {filtered.length === 0 && (
          <Text style={styles.emptyText}>No members found.</Text>
        )}

        <View style={{ height: Spacing.xl }} />
      </ScrollView>

      {/* Add Family Member Modal */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <ScrollView style={styles.modal}>
          <Text style={styles.modalTitle}>Add Family Member</Text>
          <Text style={styles.modalSubtitle}>
            Add a family member or tenant to an existing flat.
          </Text>

          <Text style={styles.fieldLabel}>Flat Number *</Text>
          <TextInput style={styles.input} value={newMember.flatNumber}
            onChangeText={v => setNewMember(p => ({ ...p, flatNumber: v }))}
            placeholder="e.g. 201" />

          <Text style={styles.fieldLabel}>Wing (optional)</Text>
          <TextInput style={styles.input} value={newMember.wing}
            onChangeText={v => setNewMember(p => ({ ...p, wing: v }))}
            placeholder="e.g. A" />

          <Text style={styles.fieldLabel}>Member Type</Text>
          <View style={styles.typeRow}>
            {MEMBER_TYPES.map(t => (
              <TouchableOpacity key={t}
                style={[styles.typeChip, newMember.memberType === t && styles.typeChipActive]}
                onPress={() => setNewMember(p => ({ ...p, memberType: t }))}>
                <Text style={[styles.typeChipText, newMember.memberType === t && { color: '#fff' }]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Full Name *</Text>
          <TextInput style={styles.input} value={newMember.name}
            onChangeText={v => setNewMember(p => ({ ...p, name: v }))}
            placeholder="e.g. Priya Sharma" />

          <Text style={styles.fieldLabel}>Mobile *</Text>
          <TextInput style={styles.input} value={newMember.phone}
            onChangeText={v => setNewMember(p => ({ ...p, phone: v }))}
            keyboardType="phone-pad" placeholder="e.g. 9876543210" />

          <Text style={styles.fieldLabel}>Email (optional)</Text>
          <TextInput style={styles.input} value={newMember.email}
            onChangeText={v => setNewMember(p => ({ ...p, email: v }))}
            keyboardType="email-address" autoCapitalize="none"
            placeholder="e.g. priya@email.com" />

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAdd(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitBtn} onPress={addFamilyMember}>
              <Text style={styles.submitBtnText}>Add Member</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: Spacing.xl }} />
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: Colors.background },
  center:             { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:             { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                        padding: Spacing.md, backgroundColor: Colors.surface,
                        borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle:        { ...Typography.h2 },
  addBtn:             { backgroundColor: Colors.primary, paddingHorizontal: Spacing.md,
                        paddingVertical: Spacing.xs, borderRadius: 8 },
  addBtnText:         { color: '#fff', fontWeight: '600' },
  searchBar:          { padding: Spacing.sm, backgroundColor: Colors.surface,
                        borderBottomWidth: 1, borderBottomColor: Colors.border },
  searchInput:        { backgroundColor: Colors.background, borderRadius: 8, padding: Spacing.sm,
                        ...Typography.body1, borderWidth: 1, borderColor: Colors.border },
  filterRow:          { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
                        backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  filterChip:         { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: 16,
                        borderWidth: 1, borderColor: Colors.border, marginRight: Spacing.xs },
  filterChipActive:   { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText:     { ...Typography.caption, color: Colors.textSecondary },
  filterChipTextActive: { color: '#fff', fontWeight: '600' },
  summaryBar:         { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
                        backgroundColor: Colors.divider },
  summaryText:        { ...Typography.caption, color: Colors.textSecondary },
  flatGroup:          { marginHorizontal: Spacing.md, marginTop: Spacing.sm,
                        backgroundColor: Colors.surface, borderRadius: 10,
                        overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  flatHeader:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                        padding: Spacing.md },
  flatNumber:         { ...Typography.h4 },
  flatMeta:           { ...Typography.caption, color: Colors.textSecondary },
  chevron:            { ...Typography.caption, color: Colors.textSecondary },
  memberRow:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                        paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
                        borderTopWidth: 1, borderTopColor: Colors.divider },
  memberCard:         { marginHorizontal: Spacing.md, marginTop: Spacing.sm,
                        backgroundColor: Colors.surface, borderRadius: 10, padding: Spacing.md,
                        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                        borderWidth: 1, borderColor: Colors.border },
  memberInfo:         { flex: 1, gap: 2 },
  memberName:         { ...Typography.body1, fontWeight: '600' },
  memberSub:          { ...Typography.caption, color: Colors.textSecondary },
  memberRight:        { alignItems: 'flex-end', gap: Spacing.xs },
  badge:              { paddingHorizontal: Spacing.xs, paddingVertical: 2, borderRadius: 4 },
  badgeText:          { ...Typography.caption, color: '#fff', fontWeight: '600' },
  removeText:         { ...Typography.caption, color: Colors.error },
  emptyText:          { ...Typography.body1, color: Colors.textSecondary, textAlign: 'center',
                        marginTop: 48 },
  modal:              { flex: 1, padding: Spacing.lg, backgroundColor: Colors.background },
  modalTitle:         { ...Typography.h2, marginBottom: Spacing.xs },
  modalSubtitle:      { ...Typography.body2, color: Colors.textSecondary, marginBottom: Spacing.md },
  fieldLabel:         { ...Typography.caption, color: Colors.textSecondary, marginBottom: Spacing.xs },
  input:              { borderWidth: 1, borderColor: Colors.border, borderRadius: 8,
                        padding: Spacing.sm, ...Typography.body1, marginBottom: Spacing.md,
                        backgroundColor: Colors.surface },
  typeRow:            { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  typeChip:           { flex: 1, padding: Spacing.sm, borderRadius: 8, borderWidth: 1,
                        borderColor: Colors.border, alignItems: 'center' },
  typeChipActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeChipText:       { ...Typography.body2, fontWeight: '600' },
  modalActions:       { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  cancelBtn:          { flex: 1, padding: Spacing.md, borderRadius: 8, borderWidth: 1,
                        borderColor: Colors.border, alignItems: 'center' },
  cancelBtnText:      { ...Typography.body1 },
  submitBtn:          { flex: 1, padding: Spacing.md, borderRadius: 8,
                        backgroundColor: Colors.primary, alignItems: 'center' },
  submitBtnText:      { color: '#fff', fontWeight: '600', ...Typography.body1 },
});
