import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Switch,
  FlatList,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';

// ── Theme alias bridge ─────────────────────────────────────────────────────
const colors = {
  ...Colors,
  backgroundSecondary: Colors.divider,
  successLight: '#d4edda',
  warningLight: '#fff3cd',
  errorLight: '#f8d7da',
  infoLight: '#d1ecf1',
};
const spacing = Spacing;
const typography = { ...Typography, body: Typography.body1 };

// ── Types ──────────────────────────────────────────────────────────────────
interface ParkingLevel {
  id: string;
  name: string;
  levelNumber: number;
  floorPlanUrl?: string;
  totalSlots: number;
  availableSlots: number;
}

interface ParkingSlot {
  id: string;
  slotNumber: string;
  type: string;
  status: 'Available' | 'AssignedResident' | 'VisitorPass' | 'Maintenance';
  isEvCharger: boolean;
  assignedFlatNumber?: string;
  vehicleNumber?: string;
  vehicleType?: string;
}

const STATUS_COLORS: Record<string, string> = {
  Available:        colors.successLight,
  AssignedResident: colors.infoLight,
  VisitorPass:      colors.warningLight,
  Maintenance:      colors.errorLight,
};

const STATUS_LABELS: Record<string, string> = {
  Available:        'Available',
  AssignedResident: 'Assigned',
  VisitorPass:      'Visitor',
  Maintenance:      'Maint.',
};

const STATUS_BORDER: Record<string, string> = {
  Available:        '#28a745',
  AssignedResident: '#17a2b8',
  VisitorPass:      '#ffc107',
  Maintenance:      '#dc3545',
};

// ── API ────────────────────────────────────────────────────────────────────
const API_BASE = 'http://localhost:8080/api/v1';

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(opts?.headers ?? {}) },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(err.message ?? 'Request failed');
  }
  return res.json();
}

// ── Add Level Modal ────────────────────────────────────────────────────────
interface AddLevelModalProps {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
}

function AddLevelModal({ visible, onClose, onAdded }: AddLevelModalProps) {
  const [name, setName]               = useState('');
  const [levelNumber, setLevelNumber] = useState('');
  const [loading, setLoading]         = useState(false);

  const handleAdd = async () => {
    if (!name.trim()) { Alert.alert('Validation', 'Level name is required.'); return; }
    const num = parseInt(levelNumber, 10);
    if (isNaN(num)) { Alert.alert('Validation', 'Enter a valid level number.'); return; }

    setLoading(true);
    try {
      await apiFetch('/parking/levels', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), levelNumber: num }),
      });
      setName(''); setLevelNumber('');
      onAdded(); onClose();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Add Parking Level</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalClose}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.modalBody}>
          <Text style={styles.inputLabel}>Level Name *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Basement 1"
            value={name}
            onChangeText={setName}
            placeholderTextColor={colors.textSecondary}
          />
          <Text style={styles.inputLabel}>Level Number *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. -1 for basement, 0 for ground"
            value={levelNumber}
            onChangeText={setLevelNumber}
            keyboardType="numbers-and-punctuation"
            placeholderTextColor={colors.textSecondary}
          />
        </View>
        <View style={styles.modalFooter}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleAdd} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" size="small" /> :
              <Text style={styles.submitBtnText}>Add Level</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Add Slot Modal ─────────────────────────────────────────────────────────
interface AddSlotModalProps {
  visible: boolean;
  levelId: string;
  onClose: () => void;
  onAdded: () => void;
}

const SLOT_TYPES = ['Car', 'Bike', 'Heavy'];

function AddSlotModal({ visible, levelId, onClose, onAdded }: AddSlotModalProps) {
  const [slotNumber, setSlotNumber] = useState('');
  const [slotType, setSlotType]     = useState('Car');
  const [isEv, setIsEv]             = useState(false);
  const [loading, setLoading]       = useState(false);

  const handleAdd = async () => {
    if (!slotNumber.trim()) { Alert.alert('Validation', 'Slot number is required.'); return; }
    setLoading(true);
    try {
      await apiFetch('/parking/slots', {
        method: 'POST',
        body: JSON.stringify({
          levelId,
          slotNumber: slotNumber.trim().toUpperCase(),
          type: slotType,
          isEvCharger: isEv,
        }),
      });
      setSlotNumber(''); setSlotType('Car'); setIsEv(false);
      onAdded(); onClose();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Add Parking Slot</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalClose}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.modalBody}>
          <Text style={styles.inputLabel}>Slot Number *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. A-01"
            value={slotNumber}
            onChangeText={setSlotNumber}
            autoCapitalize="characters"
            placeholderTextColor={colors.textSecondary}
          />
          <Text style={styles.inputLabel}>Slot Type *</Text>
          <View style={styles.typeChips}>
            {SLOT_TYPES.map(t => (
              <TouchableOpacity key={t}
                style={[styles.typeChip, slotType === t && styles.typeChipSelected]}
                onPress={() => setSlotType(t)}>
                <Text style={[styles.typeChipText, slotType === t && styles.typeChipTextSelected]}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>EV Charger Available</Text>
            <Switch value={isEv} onValueChange={setIsEv} trackColor={{ true: colors.primary }} />
          </View>
        </View>
        <View style={styles.modalFooter}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleAdd} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" size="small" /> :
              <Text style={styles.submitBtnText}>Add Slot</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Assign Slot Modal ──────────────────────────────────────────────────────
interface AssignSlotModalProps {
  visible: boolean;
  slot: ParkingSlot | null;
  onClose: () => void;
  onDone: () => void;
}

function AssignSlotModal({ visible, slot, onClose, onDone }: AssignSlotModalProps) {
  const [flatId, setFlatId]           = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('Car');
  const [loading, setLoading]         = useState(false);

  const handleAssign = async () => {
    if (!flatId.trim() || !vehicleNumber.trim()) {
      Alert.alert('Validation', 'Flat ID and vehicle number are required.');
      return;
    }
    setLoading(true);
    try {
      await apiFetch(`/parking/slots/${slot!.id}/assign`, {
        method: 'POST',
        body: JSON.stringify({
          flatId: flatId.trim(),
          vehicleNumber: vehicleNumber.trim().toUpperCase(),
          vehicleType,
        }),
      });
      setFlatId(''); setVehicleNumber(''); setVehicleType('Car');
      onDone(); onClose();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  };

  if (!slot) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Assign Slot {slot.slotNumber}</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalClose}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.modalBody}>
          <Text style={styles.inputLabel}>Flat ID *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="UUID of the flat"
            value={flatId}
            onChangeText={setFlatId}
            autoCapitalize="none"
            placeholderTextColor={colors.textSecondary}
          />
          <Text style={styles.inputLabel}>Vehicle Number *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. MH12AB1234"
            value={vehicleNumber}
            onChangeText={setVehicleNumber}
            autoCapitalize="characters"
            placeholderTextColor={colors.textSecondary}
          />
          <Text style={styles.inputLabel}>Vehicle Type *</Text>
          <View style={styles.typeChips}>
            {['Car', 'Bike', 'EV', 'Heavy'].map(t => (
              <TouchableOpacity key={t}
                style={[styles.typeChip, vehicleType === t && styles.typeChipSelected]}
                onPress={() => setVehicleType(t)}>
                <Text style={[styles.typeChipText, vehicleType === t && styles.typeChipTextSelected]}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={styles.modalFooter}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleAssign} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" size="small" /> :
              <Text style={styles.submitBtnText}>Assign</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Slot Grid Item ─────────────────────────────────────────────────────────
function SlotGridItem({
  slot,
  onPress,
}: {
  slot: ParkingSlot;
  onPress: (slot: ParkingSlot) => void;
}) {
  const bgColor = STATUS_COLORS[slot.status] ?? colors.backgroundSecondary;
  const borderColor = STATUS_BORDER[slot.status] ?? colors.divider;

  return (
    <TouchableOpacity
      style={[styles.slotGridItem, { backgroundColor: bgColor, borderColor }]}
      onPress={() => onPress(slot)}
      activeOpacity={0.7}>
      <Text style={styles.slotGridNumber}>{slot.slotNumber}</Text>
      <Text style={styles.slotGridStatus}>{STATUS_LABELS[slot.status]}</Text>
      {slot.isEvCharger && <Text style={styles.slotGridEv}>⚡</Text>}
      {slot.vehicleNumber && (
        <Text style={styles.slotGridVehicle} numberOfLines={1}>{slot.vehicleNumber}</Text>
      )}
    </TouchableOpacity>
  );
}

// ── Slot Action Sheet ──────────────────────────────────────────────────────
interface SlotActionsProps {
  slot: ParkingSlot | null;
  visible: boolean;
  onClose: () => void;
  onAssign: () => void;
  onUnassign: (slotId: string) => void;
  onMaintenance: (slotId: string) => void;
}

function SlotActionSheet({ slot, visible, onClose, onAssign, onUnassign, onMaintenance }: SlotActionsProps) {
  if (!slot) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.actionSheetOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.actionSheet}>
          <View style={styles.actionSheetHandle} />
          <Text style={styles.actionSheetTitle}>Slot {slot.slotNumber}</Text>
          <Text style={styles.actionSheetSubtitle}>
            {slot.type} · {STATUS_LABELS[slot.status]}
            {slot.isEvCharger ? ' · ⚡ EV' : ''}
          </Text>

          {slot.vehicleNumber ? (
            <View style={styles.actionSheetInfo}>
              <Text style={styles.actionSheetInfoText}>
                🚗 {slot.vehicleNumber}
                {slot.assignedFlatNumber ? `  |  Flat ${slot.assignedFlatNumber}` : ''}
              </Text>
            </View>
          ) : null}

          <View style={styles.actionSheetDivider} />

          {slot.status === 'Available' && (
            <TouchableOpacity style={styles.actionBtn} onPress={() => { onClose(); onAssign(); }}>
              <Text style={styles.actionBtnText}>Assign to Resident</Text>
            </TouchableOpacity>
          )}

          {(slot.status === 'AssignedResident' || slot.status === 'VisitorPass') && (
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnWarning]}
              onPress={() => { onClose(); onUnassign(slot.id); }}>
              <Text style={[styles.actionBtnText, styles.actionBtnTextWarning]}>Unassign Slot</Text>
            </TouchableOpacity>
          )}

          {slot.status !== 'Maintenance' && (
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger]}
              onPress={() => { onClose(); onMaintenance(slot.id); }}>
              <Text style={[styles.actionBtnText, styles.actionBtnTextDanger]}>Mark Under Maintenance</Text>
            </TouchableOpacity>
          )}

          {slot.status === 'Maintenance' && (
            <TouchableOpacity style={styles.actionBtn}
              onPress={() => { onClose(); onUnassign(slot.id); }}>
              <Text style={styles.actionBtnText}>Clear Maintenance — Mark Available</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnCancel]} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Legend ─────────────────────────────────────────────────────────────────
function Legend() {
  return (
    <View style={styles.legend}>
      {Object.entries(STATUS_LABELS).map(([key, label]) => (
        <View key={key} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: STATUS_BORDER[key] }]} />
          <Text style={styles.legendText}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────
export default function ParkingManagementScreen() {
  const [levels, setLevels]               = useState<ParkingLevel[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<ParkingLevel | null>(null);
  const [slots, setSlots]                 = useState<ParkingSlot[]>([]);
  const [loading, setLoading]             = useState(true);
  const [slotsLoading, setSlotsLoading]   = useState(false);
  const [refreshing, setRefreshing]       = useState(false);

  const [showAddLevel, setShowAddLevel]   = useState(false);
  const [showAddSlot, setShowAddSlot]     = useState(false);
  const [selectedSlot, setSelectedSlot]  = useState<ParkingSlot | null>(null);
  const [showSlotActions, setShowSlotActions] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);

  // ── Data fetching ────────────────────────────────────────────────────────
  const fetchLevels = useCallback(async () => {
    try {
      const data = await apiFetch<ParkingLevel[]>('/parking/levels');
      setLevels(data);
      if (data.length > 0 && !selectedLevel) {
        setSelectedLevel(data[0]);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedLevel]);

  const fetchSlots = useCallback(async (levelId: string) => {
    setSlotsLoading(true);
    try {
      const data = await apiFetch<ParkingSlot[]>(`/parking/levels/${levelId}/slots`);
      setSlots(data);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  React.useEffect(() => { fetchLevels(); }, []);

  React.useEffect(() => {
    if (selectedLevel) fetchSlots(selectedLevel.id);
  }, [selectedLevel]);

  const handleRefresh = () => { setRefreshing(true); fetchLevels(); };

  // ── Slot actions ─────────────────────────────────────────────────────────
  const handleUnassign = (slotId: string) => {
    Alert.alert('Unassign Slot', 'Remove the current assignment from this slot?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unassign', style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch(`/parking/slots/${slotId}/unassign`, { method: 'POST' });
            if (selectedLevel) fetchSlots(selectedLevel.id);
            fetchLevels();
          } catch (e: any) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  };

  const handleMaintenance = async (slotId: string) => {
    Alert.alert('Maintenance', 'Mark this slot as under maintenance?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          try {
            // Unassign first then the domain will set it to Available;
            // In production you'd have a dedicated SetMaintenance command.
            await apiFetch(`/parking/slots/${slotId}/unassign`, { method: 'POST' });
            if (selectedLevel) fetchSlots(selectedLevel.id);
            fetchLevels();
          } catch (e: any) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading parking data…</Text>
      </View>
    );
  }

  const occupiedCount = slots.filter(s => s.status !== 'Available').length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Parking Management</Text>
        <TouchableOpacity style={styles.addLevelBtn} onPress={() => setShowAddLevel(true)}>
          <Text style={styles.addLevelBtnText}>+ Level</Text>
        </TouchableOpacity>
      </View>

      {/* Level tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.levelTabsScroll}
        contentContainerStyle={styles.levelTabsContent}>
        {levels.map(level => (
          <TouchableOpacity
            key={level.id}
            style={[styles.levelTab, selectedLevel?.id === level.id && styles.levelTabActive]}
            onPress={() => setSelectedLevel(level)}>
            <Text style={[styles.levelTabText, selectedLevel?.id === level.id && styles.levelTabTextActive]}>
              {level.name}
            </Text>
            <View style={styles.levelTabBadge}>
              <Text style={styles.levelTabBadgeText}>
                {level.availableSlots}/{level.totalSlots}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {!levels.length ? (
        <View style={styles.emptyLevels}>
          <Text style={styles.emptyLevelsIcon}>🅿️</Text>
          <Text style={styles.emptyLevelsTitle}>No Parking Levels</Text>
          <Text style={styles.emptyLevelsSubtitle}>Add a level to get started.</Text>
          <TouchableOpacity style={styles.submitBtn} onPress={() => setShowAddLevel(true)}>
            <Text style={styles.submitBtnText}>Add First Level</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh}
            tintColor={colors.primary} />}>

          {/* Stats bar */}
          {selectedLevel && (
            <View style={styles.statsBar}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{selectedLevel.totalSlots}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#28a745' }]}>{selectedLevel.availableSlots}</Text>
                <Text style={styles.statLabel}>Available</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#17a2b8' }]}>{occupiedCount}</Text>
                <Text style={styles.statLabel}>Occupied</Text>
              </View>
            </View>
          )}

          {/* Legend */}
          <Legend />

          {/* Add slot button */}
          <View style={styles.slotGridHeader}>
            <Text style={styles.slotGridTitle}>
              Slots {selectedLevel ? `— ${selectedLevel.name}` : ''}
            </Text>
            <TouchableOpacity style={styles.addSlotBtn} onPress={() => setShowAddSlot(true)}>
              <Text style={styles.addSlotBtnText}>+ Add Slot</Text>
            </TouchableOpacity>
          </View>

          {/* Slot grid */}
          {slotsLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
          ) : !slots.length ? (
            <View style={styles.emptySlots}>
              <Text style={styles.emptySlotsText}>
                No slots in this level yet. Tap "+ Add Slot" to create one.
              </Text>
            </View>
          ) : (
            <View style={styles.slotGrid}>
              {slots.map(slot => (
                <SlotGridItem
                  key={slot.id}
                  slot={slot}
                  onPress={s => {
                    setSelectedSlot(s);
                    setShowSlotActions(true);
                  }}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Modals */}
      <AddLevelModal
        visible={showAddLevel}
        onClose={() => setShowAddLevel(false)}
        onAdded={fetchLevels}
      />

      {selectedLevel && (
        <AddSlotModal
          visible={showAddSlot}
          levelId={selectedLevel.id}
          onClose={() => setShowAddSlot(false)}
          onAdded={() => {
            fetchLevels();
            if (selectedLevel) fetchSlots(selectedLevel.id);
          }}
        />
      )}

      <SlotActionSheet
        slot={selectedSlot}
        visible={showSlotActions}
        onClose={() => setShowSlotActions(false)}
        onAssign={() => setShowAssignModal(true)}
        onUnassign={handleUnassign}
        onMaintenance={handleMaintenance}
      />

      <AssignSlotModal
        visible={showAssignModal}
        slot={selectedSlot}
        onClose={() => setShowAssignModal(false)}
        onDone={() => {
          fetchLevels();
          if (selectedLevel) fetchSlots(selectedLevel.id);
        }}
      />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.background, gap: spacing.sm,
  },
  loadingText: { ...typography.body, color: colors.textSecondary },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerTitle: { ...typography.h2, color: colors.text },
  addLevelBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  addLevelBtnText: { ...typography.body, color: '#fff', fontWeight: '600' },

  // Level tabs
  levelTabsScroll: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    maxHeight: 56,
  },
  levelTabsContent: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.sm,
    alignItems: 'center',
  },
  levelTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.divider,
    gap: spacing.xs,
  },
  levelTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  levelTabText: { ...typography.body, color: colors.textSecondary, fontWeight: '500' },
  levelTabTextActive: { color: '#fff', fontWeight: '700' },
  levelTabBadge: {
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  levelTabBadgeText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },

  // Scroll
  scrollView: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xl },

  // Stats bar
  statsBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { ...typography.h2, color: colors.text },
  statLabel: { ...typography.caption, color: colors.textSecondary },
  statDivider: { width: 1, backgroundColor: colors.divider, marginVertical: spacing.xs },

  // Legend
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { ...typography.caption, color: colors.textSecondary },

  // Slot grid header
  slotGridHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  slotGridTitle: { ...typography.h3, color: colors.text },
  addSlotBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  addSlotBtnText: { ...typography.body, color: colors.primary, fontWeight: '600' },

  // Slot grid
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  slotGridItem: {
    width: '30%',
    borderRadius: 8,
    padding: spacing.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    minHeight: 70,
    justifyContent: 'center',
  },
  slotGridNumber: { ...typography.body, color: colors.text, fontWeight: '700', fontSize: 13 },
  slotGridStatus: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  slotGridEv: { fontSize: 12, marginTop: 2 },
  slotGridVehicle: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },

  // Empty states
  emptyLevels: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: spacing.xl, gap: spacing.sm,
  },
  emptyLevelsIcon: { fontSize: 56 },
  emptyLevelsTitle: { ...typography.h2, color: colors.text },
  emptyLevelsSubtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  emptySlots: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.divider,
  },
  emptySlotsText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },

  // Action sheet
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  actionSheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.divider,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  actionSheetTitle: { ...typography.h3, color: colors.text, textAlign: 'center' },
  actionSheetSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  actionSheetInfo: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  actionSheetInfoText: { ...typography.body, color: colors.text, textAlign: 'center' },
  actionSheetDivider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.sm },
  actionBtn: {
    paddingVertical: spacing.md,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: spacing.xs,
    backgroundColor: colors.backgroundSecondary,
  },
  actionBtnWarning: { backgroundColor: '#fff3cd' },
  actionBtnDanger:  { backgroundColor: '#f8d7da' },
  actionBtnCancel:  { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.divider },
  actionBtnText: { ...typography.body, color: colors.text, fontWeight: '600' },
  actionBtnTextWarning: { color: '#856404' },
  actionBtnTextDanger:  { color: '#721c24' },

  // Modal
  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
    backgroundColor: colors.surface,
  },
  modalTitle: { ...typography.h2, color: colors.text },
  modalClose: { fontSize: 20, color: colors.textSecondary, paddingHorizontal: spacing.sm },
  modalBody: { flex: 1, padding: spacing.md },
  modalFooter: {
    flexDirection: 'row', padding: spacing.md, gap: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.divider,
    backgroundColor: colors.surface,
  },

  // Form
  inputLabel: {
    ...typography.body, color: colors.textSecondary,
    marginBottom: spacing.xs, marginTop: spacing.sm,
  },
  textInput: {
    backgroundColor: colors.surface, borderRadius: 8,
    borderWidth: 1, borderColor: colors.divider,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    ...typography.body, color: colors.text,
  },
  typeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xs },
  typeChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: 20, borderWidth: 1, borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  typeChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeChipText: { ...typography.body, color: colors.textSecondary, fontWeight: '500' },
  typeChipTextSelected: { color: '#fff', fontWeight: '700' },
  switchRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  switchLabel: { ...typography.body, color: colors.text },

  // Buttons
  cancelBtn: {
    flex: 1, paddingVertical: spacing.sm, borderRadius: 8,
    alignItems: 'center', borderWidth: 1, borderColor: colors.divider,
  },
  cancelBtnText: { ...typography.body, color: colors.textSecondary, fontWeight: '600' },
  submitBtn: {
    flex: 2, backgroundColor: colors.primary,
    paddingVertical: spacing.sm, borderRadius: 8, alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { ...typography.body, color: '#fff', fontWeight: '700' },
});
