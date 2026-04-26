import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert, Modal,
  TextInput, ScrollView, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../services/api/apiClient';
import { useAuthStore } from '../../store/authStore';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ComplaintSummary {
  id: string;
  ticketNumber: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  resolvedAt?: string;
}

interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

const CATEGORIES = ['Plumbing', 'Electrical', 'Lift', 'Security', 'Cleanliness', 'Parking', 'Noise', 'Other'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

// ── API ────────────────────────────────────────────────────────────────────────

const fetchMyComplaints = async (status?: string): Promise<PagedResult<ComplaintSummary>> => {
  const params = new URLSearchParams({ page: '1', pageSize: '50' });
  if (status) params.set('status', status);
  const { data } = await apiClient.get<PagedResult<ComplaintSummary>>(
    `/complaints/my?${params}`
  );
  return data;
};

const raiseComplaint = async (payload: {
  societyId: string;
  flatId: string;
  title: string;
  description: string;
  category: string;
  priority: string;
}): Promise<{ complaintId: string; ticketNumber: string }> => {
  const { data } = await apiClient.post('/complaints', payload);
  return data;
};

const getUploadUrl = async (
  complaintId: string,
  fileName: string
): Promise<{ uploadUrl: string; objectKey: string }> => {
  const { data } = await apiClient.post(
    `/complaints/${complaintId}/upload-url`,
    { fileName }
  );
  return data;
};

// Upload directly to MinIO pre-signed URL — never hits API server
const uploadToMinio = async (presignedUrl: string, imageUri: string): Promise<void> => {
  const response = await fetch(imageUri);
  const blob = await response.blob();
  await fetch(presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': blob.type },
    body: blob,
  });
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function ComplaintsScreen() {
  const { activeSocietyId, flatId } = useAuthStore();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [modalVisible, setModalVisible] = useState(false);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [priority, setPriority] = useState('Medium');
  const [pickedImages, setPickedImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['complaints', filter],
    queryFn: () => fetchMyComplaints(filter),
    staleTime: 30_000,
  });

  // ── Submit complaint ────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert('Missing fields', 'Please fill in title and description.');
      return;
    }
    if (!activeSocietyId || !flatId) {
      Alert.alert('Error', 'Society or flat information missing. Please log in again.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Raise the complaint
      const result = await raiseComplaint({
        societyId: activeSocietyId,
        flatId,
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
      });

      // 2. Upload images directly to MinIO (if any)
      for (const imageUri of pickedImages) {
        const fileName = `photo_${Date.now()}.jpg`;
        const { uploadUrl } = await getUploadUrl(result.complaintId, fileName);
        await uploadToMinio(uploadUrl, imageUri);
      }

      queryClient.invalidateQueries({ queryKey: ['complaints'] });
      setModalVisible(false);
      resetForm();
      Alert.alert(
        'Complaint Submitted',
        `Your ticket ${result.ticketNumber} has been raised. We'll keep you updated.`
      );
    } catch {
      Alert.alert('Error', 'Could not submit complaint. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [title, description, category, priority, pickedImages, activeSocietyId, flatId, queryClient]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory(CATEGORIES[0]);
    setPriority('Medium');
    setPickedImages([]);
  };

  // ── Image picker ─────────────────────────────────────────────────────────────
  const pickImage = useCallback(async () => {
    if (pickedImages.length >= 3) {
      Alert.alert('Limit reached', 'You can attach up to 3 photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setPickedImages((prev: string[]) => [...prev, result.assets[0].uri]);
    }
  }, [pickedImages]);

  // ── Status badge ─────────────────────────────────────────────────────────────
  const statusColor: Record<string, string> = {
    Open:       Colors.info,
    InProgress: Colors.warning,
    Resolved:   Colors.success,
    Closed:     Colors.textSecondary,
    Reopened:   Colors.error,
  };

  const priorityColor: Record<string, string> = {
    Low:      Colors.textSecondary,
    Medium:   Colors.info,
    High:     Colors.warning,
    Critical: Colors.error,
  };

  // ── Render item ──────────────────────────────────────────────────────────────
  const renderItem = ({ item }: { item: ComplaintSummary }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardInfo}>
          <Text style={styles.ticketNo}>{item.ticketNumber}</Text>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <View style={styles.chipRow}>
            <View style={[styles.chip, { borderColor: priorityColor[item.priority] ?? Colors.border }]}>
              <Text style={[styles.chipText, { color: priorityColor[item.priority] ?? Colors.textSecondary }]}>
                {item.priority}
              </Text>
            </View>
            <View style={[styles.chip, { borderColor: Colors.border }]}>
              <Text style={styles.chipText}>{item.category}</Text>
            </View>
          </View>
        </View>
        <View style={[styles.badge, { backgroundColor: statusColor[item.status] ?? Colors.textSecondary }]}>
          <Text style={styles.badgeText}>{item.status}</Text>
        </View>
      </View>
      <Text style={styles.time}>
        {new Date(item.createdAt).toLocaleDateString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric',
        })}
        {item.resolvedAt ? ` · Resolved ${new Date(item.resolvedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}` : ''}
      </Text>
    </View>
  );

  // ── Filter tabs ───────────────────────────────────────────────────────────────
  const tabs = [
    { label: 'All',        value: undefined },
    { label: 'Open',       value: 'Open' },
    { label: 'In Progress',value: 'InProgress' },
    { label: 'Resolved',   value: 'Resolved' },
  ];

  return (
    <View style={styles.container}>
      {/* Filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={styles.tabsWrapper} contentContainerStyle={styles.tabs}>
        {tabs.map(t => (
          <TouchableOpacity
            key={t.label}
            style={[styles.tab, filter === t.value && styles.tabActive]}
            onPress={() => setFilter(t.value)}>
            <Text style={[styles.tabText, filter === t.value && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* List */}
      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={(c: ComplaintSummary) => c.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyLabel}>No complaints yet</Text>
            </View>
          }
        />
      )}

      {/* FAB — raise new complaint */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+ Raise Complaint</Text>
      </TouchableOpacity>

      {/* ── New Complaint Modal ───────────────────────────────────────────── */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Raise Complaint</Text>
            <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Title */}
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Water leakage in bathroom"
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />

            {/* Description */}
            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe the issue in detail..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              maxLength={500}
            />

            {/* Category */}
            <Text style={styles.label}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              style={styles.chipScroll}>
              {CATEGORIES.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.selectChip, category === c && styles.selectChipActive]}
                  onPress={() => setCategory(c)}>
                  <Text style={[styles.selectChipText, category === c && styles.selectChipTextActive]}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Priority */}
            <Text style={styles.label}>Priority</Text>
            <View style={styles.priorityRow}>
              {PRIORITIES.map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.priorityBtn, priority === p && { backgroundColor: priorityColor[p] ?? Colors.primary }]}
                  onPress={() => setPriority(p)}>
                  <Text style={[styles.priorityBtnText, priority === p && { color: '#fff' }]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Photos */}
            <Text style={styles.label}>Photos (optional, max 3)</Text>
            <View style={styles.photoRow}>
              {pickedImages.map((uri: string, idx: number) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.photoThumb}
                  onPress={() => setPickedImages((prev: string[]) => prev.filter((_: string, i: number) => i !== idx))}>
                  <Text style={styles.photoThumbText}>📷 Photo {idx + 1}</Text>
                  <Text style={styles.photoRemove}>✕</Text>
                </TouchableOpacity>
              ))}
              {pickedImages.length < 3 && (
                <TouchableOpacity style={styles.addPhoto} onPress={pickImage}>
                  <Text style={styles.addPhotoText}>+ Add Photo</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}>
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Submit Complaint</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:            { flex: 1, backgroundColor: Colors.background },
  tabsWrapper:          { maxHeight: 52, backgroundColor: Colors.surface },
  tabs:                 { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.xs, flexDirection: 'row' },
  tab:                  { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.background },
  tabActive:            { backgroundColor: Colors.primary },
  tabText:              { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  tabTextActive:        { color: '#fff', fontWeight: '600' },
  loader:               { flex: 1 },
  list:                 { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 80 },
  card:                 { backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  cardTop:              { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardInfo:             { flex: 1, gap: 4 },
  ticketNo:             { fontSize: 11, color: Colors.textSecondary, fontWeight: '600', letterSpacing: 0.5 },
  cardTitle:            { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  chipRow:              { flexDirection: 'row', gap: Spacing.xs, marginTop: 2 },
  chip:                 { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1 },
  chipText:             { fontSize: 11, color: Colors.textSecondary },
  badge:                { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, marginLeft: Spacing.sm },
  badgeText:            { fontSize: 11, color: '#fff', fontWeight: '700' },
  time:                 { fontSize: 11, color: Colors.textDisabled, marginTop: Spacing.xs },
  empty:                { alignItems: 'center', paddingTop: 80, gap: Spacing.sm },
  emptyIcon:            { fontSize: 48 },
  emptyLabel:           { fontSize: 15, color: Colors.textSecondary, fontWeight: '500' },
  fab:                  { position: 'absolute', bottom: 24, right: 20, left: 20, backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', elevation: 6 },
  fabText:              { color: '#fff', fontWeight: '700', fontSize: 15 },
  // Modal
  modal:                { flex: 1, backgroundColor: Colors.background },
  modalHeader:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle:           { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  modalClose:           { fontSize: 18, color: Colors.textSecondary, padding: 4 },
  modalBody:            { padding: Spacing.md },
  label:                { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginTop: Spacing.md, marginBottom: 6 },
  input:                { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: Colors.textPrimary },
  textArea:             { minHeight: 90, textAlignVertical: 'top' },
  chipScroll:           { flexGrow: 0 },
  selectChip:           { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, marginRight: Spacing.xs },
  selectChipActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  selectChipText:       { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  selectChipTextActive: { color: '#fff' },
  priorityRow:          { flexDirection: 'row', gap: Spacing.xs },
  priorityBtn:          { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
  priorityBtnText:      { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  photoRow:             { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  photoThumb:           { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, gap: 6 },
  photoThumbText:       { fontSize: 13, color: Colors.textSecondary },
  photoRemove:          { fontSize: 12, color: Colors.error },
  addPhoto:             { borderWidth: 1, borderColor: Colors.primary, borderStyle: 'dashed', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  addPhotoText:         { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  submitBtn:            { marginTop: Spacing.lg, marginBottom: Spacing.xl, backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  submitBtnDisabled:    { opacity: 0.6 },
  submitBtnText:        { color: '#fff', fontWeight: '700', fontSize: 15 },
});
