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
  errorLight: '#f8d7da',
};
const spacing = Spacing;
const typography = { ...Typography, body: Typography.body1 };

// ── Types ──────────────────────────────────────────────────────────────────
interface Vehicle {
  id: string;
  registrationNumber: string;
  type: string;
  makeModel?: string;
  color?: string;
  isActive: boolean;
}

interface MyParking {
  slotNumber?: string;
  levelName?: string;
  vehicleNumber?: string;
  vehicleType?: string;
  hasEv: boolean;
  vehicles: Vehicle[];
}

const VEHICLE_TYPES = ['Car', 'Bike', 'EV', 'Heavy'];

// ── Helpers ────────────────────────────────────────────────────────────────
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

// ── Sub-components ─────────────────────────────────────────────────────────
function ParkingSlotCard({ parking }: { parking: MyParking }) {
  if (!parking.slotNumber) {
    return (
      <View style={styles.emptySlotCard}>
        <Text style={styles.emptySlotIcon}>🅿️</Text>
        <Text style={styles.emptySlotTitle}>No Slot Assigned</Text>
        <Text style={styles.emptySlotSubtitle}>
          Contact your society admin to get a parking slot assigned.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.slotCard}>
      <View style={styles.slotCardHeader}>
        <Text style={styles.slotCardTitle}>My Parking Slot</Text>
        {parking.hasEv && (
          <View style={styles.evBadge}>
            <Text style={styles.evBadgeText}>⚡ EV Charger</Text>
          </View>
        )}
      </View>

      <View style={styles.slotDetails}>
        <View style={styles.slotDetailRow}>
          <Text style={styles.slotDetailLabel}>Slot</Text>
          <Text style={styles.slotDetailValue}>{parking.slotNumber}</Text>
        </View>
        <View style={styles.slotDetailDivider} />
        <View style={styles.slotDetailRow}>
          <Text style={styles.slotDetailLabel}>Level</Text>
          <Text style={styles.slotDetailValue}>{parking.levelName ?? '—'}</Text>
        </View>
        {parking.vehicleNumber && (
          <>
            <View style={styles.slotDetailDivider} />
            <View style={styles.slotDetailRow}>
              <Text style={styles.slotDetailLabel}>Vehicle</Text>
              <Text style={styles.slotDetailValue}>
                {parking.vehicleNumber}
                {parking.vehicleType ? ` (${parking.vehicleType})` : ''}
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

function VehicleCard({
  vehicle,
  onDeactivate,
}: {
  vehicle: Vehicle;
  onDeactivate: (id: string) => void;
}) {
  return (
    <View style={[styles.vehicleCard, !vehicle.isActive && styles.vehicleCardInactive]}>
      <View style={styles.vehicleCardLeft}>
        <Text style={styles.vehicleTypeIcon}>
          {vehicle.type === 'Bike' ? '🏍️' : vehicle.type === 'EV' ? '⚡' : '🚗'}
        </Text>
        <View>
          <Text style={styles.vehicleRegNumber}>{vehicle.registrationNumber}</Text>
          {vehicle.makeModel ? (
            <Text style={styles.vehicleMeta}>{vehicle.makeModel}</Text>
          ) : null}
          {vehicle.color ? (
            <Text style={styles.vehicleMeta}>{vehicle.color}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.vehicleCardRight}>
        <View style={[styles.vehicleStatusBadge,
          vehicle.isActive ? styles.vehicleStatusActive : styles.vehicleStatusInactive]}>
          <Text style={styles.vehicleStatusText}>
            {vehicle.isActive ? 'Active' : 'Inactive'}
          </Text>
        </View>
        {vehicle.isActive && (
          <TouchableOpacity
            style={styles.vehicleDeactivateBtn}
            onPress={() => onDeactivate(vehicle.id)}>
            <Text style={styles.vehicleDeactivateBtnText}>Remove</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Add Vehicle Modal ──────────────────────────────────────────────────────
interface AddVehicleModalProps {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
}

function AddVehicleModal({ visible, onClose, onAdded }: AddVehicleModalProps) {
  const [regNumber, setRegNumber] = useState('');
  const [type, setType]           = useState('Car');
  const [makeModel, setMakeModel] = useState('');
  const [color, setColor]         = useState('');
  const [loading, setLoading]     = useState(false);

  const handleAdd = async () => {
    const reg = regNumber.trim().toUpperCase();
    if (!reg) { Alert.alert('Validation', 'Registration number is required.'); return; }

    setLoading(true);
    try {
      await apiFetch('/parking/my/vehicles', {
        method: 'POST',
        body: JSON.stringify({
          registrationNumber: reg,
          type,
          makeModel: makeModel.trim() || undefined,
          color: color.trim() || undefined,
        }),
      });
      setRegNumber(''); setMakeModel(''); setColor(''); setType('Car');
      onAdded();
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Register Vehicle</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalClose}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
          <Text style={styles.inputLabel}>Registration Number *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. MH12AB1234"
            value={regNumber}
            onChangeText={setRegNumber}
            autoCapitalize="characters"
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={styles.inputLabel}>Vehicle Type *</Text>
          <View style={styles.typeChips}>
            {VEHICLE_TYPES.map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.typeChip, type === t && styles.typeChipSelected]}
                onPress={() => setType(t)}>
                <Text style={[styles.typeChipText, type === t && styles.typeChipTextSelected]}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.inputLabel}>Make & Model</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Maruti Swift"
            value={makeModel}
            onChangeText={setMakeModel}
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={styles.inputLabel}>Color</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. White"
            value={color}
            onChangeText={setColor}
            placeholderTextColor={colors.textSecondary}
          />
        </ScrollView>

        <View style={styles.modalFooter}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleAdd} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.submitBtnText}>Register</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────
export default function ParkingScreen() {
  const [parking, setParking]         = useState<MyParking | null>(null);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchParking = useCallback(async () => {
    try {
      const data = await apiFetch<MyParking>('/parking/my');
      setParking(data);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => { fetchParking(); }, [fetchParking]);

  const handleRefresh = () => { setRefreshing(true); fetchParking(); };

  const handleDeactivate = (vehicleId: string) => {
    Alert.alert('Remove Vehicle', 'Mark this vehicle as inactive?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch(`/parking/my/vehicles/${vehicleId}/deactivate`, { method: 'POST' });
            fetchParking();
          } catch (e: any) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading parking info…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Parking</Text>
        <TouchableOpacity style={styles.addVehicleBtn} onPress={() => setShowAddModal(true)}>
          <Text style={styles.addVehicleBtnText}>+ Add Vehicle</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh}
          tintColor={colors.primary} />}>

        {/* Slot card */}
        {parking && <ParkingSlotCard parking={parking} />}

        {/* Vehicles section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Vehicles</Text>
          <Text style={styles.sectionCount}>
            {parking?.vehicles.length ?? 0} registered
          </Text>
        </View>

        {(!parking?.vehicles.length) ? (
          <View style={styles.emptyVehicles}>
            <Text style={styles.emptyVehiclesText}>
              No vehicles registered yet. Tap "+ Add Vehicle" to register one.
            </Text>
          </View>
        ) : (
          parking.vehicles.map(v => (
            <VehicleCard key={v.id} vehicle={v} onDeactivate={handleDeactivate} />
          ))
        )}
      </ScrollView>

      <AddVehicleModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdded={fetchParking}
      />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },

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
  headerTitle: {
    ...typography.h2,
    color: colors.text,
  },
  addVehicleBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  addVehicleBtnText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '600',
  },

  // Scroll
  scrollView: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xl },

  // Empty slot card
  emptySlotCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.divider,
    borderStyle: 'dashed',
  },
  emptySlotIcon: { fontSize: 40, marginBottom: spacing.sm },
  emptySlotTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptySlotSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Slot card
  slotCard: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  slotCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  slotCardTitle: {
    ...typography.h3,
    color: '#fff',
  },
  evBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 12,
  },
  evBadgeText: {
    ...typography.caption,
    color: '#fff',
    fontWeight: '700',
  },
  slotDetails: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    padding: spacing.sm,
  },
  slotDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  slotDetailDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  slotDetailLabel: {
    ...typography.body,
    color: 'rgba(255,255,255,0.8)',
  },
  slotDetailValue: {
    ...typography.body,
    color: '#fff',
    fontWeight: '600',
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
  },
  sectionCount: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  // Empty vehicles
  emptyVehicles: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.divider,
  },
  emptyVehiclesText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Vehicle card
  vehicleCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.divider,
  },
  vehicleCardInactive: {
    opacity: 0.55,
  },
  vehicleCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  vehicleTypeIcon: { fontSize: 28 },
  vehicleRegNumber: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  vehicleMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  vehicleCardRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  vehicleStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 12,
  },
  vehicleStatusActive: { backgroundColor: colors.successLight },
  vehicleStatusInactive: { backgroundColor: colors.backgroundSecondary },
  vehicleStatusText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text,
  },
  vehicleDeactivateBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.error,
  },
  vehicleDeactivateBtnText: {
    ...typography.caption,
    color: colors.error,
    fontWeight: '600',
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.surface,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text,
  },
  modalClose: {
    fontSize: 20,
    color: colors.textSecondary,
    paddingHorizontal: spacing.sm,
  },
  modalBody: {
    flex: 1,
    padding: spacing.md,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
  },

  // Form
  inputLabel: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text,
  },
  typeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  typeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  typeChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeChipText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  typeChipTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },

  // Buttons
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.divider,
  },
  cancelBtnText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  submitBtn: {
    flex: 2,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '700',
  },
});
