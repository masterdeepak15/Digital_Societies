import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors, Typography, Spacing } from '../../theme';
import { apiFetch } from '../../utils/api';

// ── Extended tokens not in design system ────────────────────────────────────
const colors = {
  ...Colors,
  successLight: '#d4edda',
  errorLight:   '#f8d7da',
  warningLight: '#fff3cd',
  infoLight:    '#d1ecf1',
  cardBg:       '#ffffff',
  balanceBg:    '#1a237e',
  balanceText:  '#ffffff',
  creditGreen:  '#28a745',
  debitRed:     '#dc3545',
};

// ── Types ────────────────────────────────────────────────────────────────────
interface WalletBalance {
  walletId:    string;
  flatId:      string;
  balanceInr:  number;
  balancePaise: number;
}

interface WalletTransaction {
  id:          string;
  type:        'Credit' | 'Debit';
  amountInr:   number;
  description: string;
  referenceId?: string;
  createdAt:   string;
}

interface TopUpInitiateResponse {
  razorpayOrderId: string;
  amountPaise:     number;
  currency:        string;
  walletId:        string;
}

// ── Quick amount presets ─────────────────────────────────────────────────────
const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

// ── Transaction type badge colours ───────────────────────────────────────────
const TX_COLORS: Record<string, { bg: string; text: string }> = {
  Credit: { bg: colors.successLight, text: colors.creditGreen },
  Debit:  { bg: colors.errorLight,   text: colors.debitRed },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatCurrency(inr: number): string {
  return `₹${inr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// ── TopUp Modal ──────────────────────────────────────────────────────────────
interface TopUpModalProps {
  visible:  boolean;
  onClose:  () => void;
  onSuccess: () => void;
}

function TopUpModal({ visible, onClose, onSuccess }: TopUpModalProps) {
  const [amount,    setAmount]    = useState('');
  const [step,      setStep]      = useState<'input' | 'processing' | 'verifying'>('input');
  const [orderId,   setOrderId]   = useState('');
  const [error,     setError]     = useState('');

  const reset = useCallback(() => {
    setAmount('');
    setStep('input');
    setOrderId('');
    setError('');
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const amountNum = parseFloat(amount) || 0;
  const isValidAmount = amountNum >= 10 && amountNum <= 50000;

  const handleInitiate = async () => {
    if (!isValidAmount) {
      setError('Amount must be between ₹10 and ₹50,000');
      return;
    }
    setError('');
    setStep('processing');
    try {
      const res = await apiFetch<TopUpInitiateResponse>('/wallet/topup/initiate', {
        method: 'POST',
        body: JSON.stringify({ amountInr: amountNum }),
      });
      setOrderId(res.razorpayOrderId);
      // In production, open Razorpay SDK here with res.razorpayOrderId
      // For now, simulate payment and move to verify step
      Alert.alert(
        'Razorpay Payment',
        `Order created: ${res.razorpayOrderId}\n\nIn production the Razorpay SDK opens here. Simulate success?`,
        [
          { text: 'Cancel', onPress: () => { reset(); onClose(); }, style: 'cancel' },
          { text: 'Simulate Success', onPress: () => handleVerify(res.razorpayOrderId) },
        ],
      );
    } catch (e: any) {
      setError(e.message ?? 'Failed to initiate top-up');
      setStep('input');
    }
  };

  const handleVerify = async (ordId: string) => {
    setStep('verifying');
    try {
      // Simulated payment id — real flow gets this from Razorpay SDK callback
      const simulatedPaymentId = `pay_${Date.now()}`;
      const simulatedSignature = 'simulated_sig'; // real flow: HMAC from Razorpay
      await apiFetch('/wallet/topup/verify', {
        method: 'POST',
        body: JSON.stringify({
          razorpayOrderId:   ordId,
          razorpayPaymentId: simulatedPaymentId,
          razorpaySignature: simulatedSignature,
        }),
      });
      reset();
      onClose();
      onSuccess();
      Alert.alert('✅ Top-up Successful', `₹${amountNum.toFixed(2)} added to your wallet.`);
    } catch (e: any) {
      setError(e.message ?? 'Verification failed');
      setStep('input');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />

          <Text style={styles.modalTitle}>Add Money to Wallet</Text>

          {/* Quick amount chips */}
          <Text style={styles.sectionLabel}>Quick Select</Text>
          <View style={styles.quickAmountRow}>
            {QUICK_AMOUNTS.map(q => (
              <TouchableOpacity
                key={q}
                style={[styles.quickChip, amountNum === q && styles.quickChipActive]}
                onPress={() => { setAmount(String(q)); setError(''); }}
              >
                <Text style={[styles.quickChipText, amountNum === q && styles.quickChipTextActive]}>
                  ₹{q.toLocaleString('en-IN')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom amount */}
          <Text style={styles.sectionLabel}>Or Enter Amount</Text>
          <View style={styles.amountInputRow}>
            <Text style={styles.currencySymbol}>₹</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={t => { setAmount(t); setError(''); }}
            />
          </View>
          <Text style={styles.amountHint}>Min ₹10 · Max ₹50,000</Text>

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          {/* Action buttons */}
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.proceedBtn, (!isValidAmount || step !== 'input') && styles.proceedBtnDisabled]}
              onPress={handleInitiate}
              disabled={!isValidAmount || step !== 'input'}
            >
              {step === 'processing' || step === 'verifying' ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.proceedBtnText}>
                  Proceed · {isValidAmount ? formatCurrency(amountNum) : '₹0.00'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Transaction card ──────────────────────────────────────────────────────────
function TransactionCard({ tx }: { tx: WalletTransaction }) {
  const badge = TX_COLORS[tx.type] ?? TX_COLORS.Debit;
  const sign  = tx.type === 'Credit' ? '+' : '-';
  return (
    <View style={styles.txCard}>
      <View style={styles.txLeft}>
        <View style={[styles.txTypeBadge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.txTypeText, { color: badge.text }]}>{tx.type}</Text>
        </View>
        <View style={styles.txInfo}>
          <Text style={styles.txDescription} numberOfLines={1}>{tx.description}</Text>
          {!!tx.referenceId && (
            <Text style={styles.txRef} numberOfLines={1}>Ref: {tx.referenceId}</Text>
          )}
          <Text style={styles.txDate}>{formatDate(tx.createdAt)} · {formatTime(tx.createdAt)}</Text>
        </View>
      </View>
      <Text style={[styles.txAmount, { color: badge.text }]}>
        {sign}{formatCurrency(tx.amountInr)}
      </Text>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function WalletScreen() {
  const [balance,      setBalance]      = useState<WalletBalance | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [topUpVisible, setTopUpVisible] = useState(false);
  const [txPage,       setTxPage]       = useState(1);
  const [hasMore,      setHasMore]      = useState(true);
  const [txLoading,    setTxLoading]    = useState(false);
  const PAGE_SIZE = 20;

  // ── Ensure wallet exists then load balance ───────────────────────────────
  const ensureAndLoad = useCallback(async () => {
    try {
      await apiFetch('/wallet/ensure', { method: 'POST' });
      const bal = await apiFetch<WalletBalance>('/wallet/balance');
      setBalance(bal);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to load wallet');
    }
  }, []);

  // ── Load transactions (paginated) ────────────────────────────────────────
  const loadTransactions = useCallback(async (page: number, append = false) => {
    if (txLoading) return;
    setTxLoading(true);
    try {
      const data = await apiFetch<WalletTransaction[]>(
        `/wallet/transactions?page=${page}&pageSize=${PAGE_SIZE}`,
      );
      if (append) {
        setTransactions(prev => [...prev, ...data]);
      } else {
        setTransactions(data);
      }
      setHasMore(data.length === PAGE_SIZE);
      setTxPage(page);
    } catch {
      // silent — balance is still shown
    } finally {
      setTxLoading(false);
    }
  }, [txLoading]);

  // ── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      await ensureAndLoad();
      await loadTransactions(1);
      setLoading(false);
    })();
  }, []);

  // ── Pull-to-refresh ──────────────────────────────────────────────────────
  const handleRefresh = async () => {
    setRefreshing(true);
    await ensureAndLoad();
    await loadTransactions(1);
    setRefreshing(false);
  };

  // ── Load more transactions ───────────────────────────────────────────────
  const handleLoadMore = () => {
    if (hasMore && !txLoading) {
      loadTransactions(txPage + 1, true);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.loadingText}>Loading wallet…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
        }
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 40) {
            handleLoadMore();
          }
        }}
        scrollEventThrottle={400}
      >
        {/* ── Balance card ── */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceLabel}>Society Wallet</Text>
            <TouchableOpacity style={styles.topUpBtn} onPress={() => setTopUpVisible(true)}>
              <Text style={styles.topUpBtnText}>+ Add Money</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.balanceAmount}>
            {balance ? formatCurrency(balance.balanceInr) : '₹0.00'}
          </Text>
          <Text style={styles.balanceSubtext}>Available Balance</Text>

          {balance && (
            <View style={styles.balanceMeta}>
              <Text style={styles.balanceMetaText}>
                {balance.balancePaise.toLocaleString('en-IN')} paise
              </Text>
            </View>
          )}
        </View>

        {/* ── Quick actions ── */}
        <View style={styles.quickActionsRow}>
          <TouchableOpacity style={styles.quickAction} onPress={() => setTopUpVisible(true)}>
            <Text style={styles.quickActionIcon}>💳</Text>
            <Text style={styles.quickActionLabel}>Top Up</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={handleRefresh}>
            <Text style={styles.quickActionIcon}>🔄</Text>
            <Text style={styles.quickActionLabel}>Refresh</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction}>
            <Text style={styles.quickActionIcon}>📊</Text>
            <Text style={styles.quickActionLabel}>Statement</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction}>
            <Text style={styles.quickActionIcon}>❓</Text>
            <Text style={styles.quickActionLabel}>Help</Text>
          </TouchableOpacity>
        </View>

        {/* ── Info banner ── */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            💡 Your wallet balance is used for maintenance bills, facility bookings, and marketplace services.
          </Text>
        </View>

        {/* ── Transaction history ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Transaction History</Text>
          {txLoading && <ActivityIndicator color={Colors.primary} size="small" />}
        </View>

        {transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No Transactions Yet</Text>
            <Text style={styles.emptySubtitle}>
              Add money to your wallet to get started
            </Text>
            <TouchableOpacity style={styles.emptyAction} onPress={() => setTopUpVisible(true)}>
              <Text style={styles.emptyActionText}>Add Money Now</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.txList}>
            {transactions.map(tx => (
              <TransactionCard key={tx.id} tx={tx} />
            ))}
            {hasMore && (
              <TouchableOpacity style={styles.loadMoreBtn} onPress={handleLoadMore}>
                <Text style={styles.loadMoreText}>
                  {txLoading ? 'Loading…' : 'Load More'}
                </Text>
              </TouchableOpacity>
            )}
            {!hasMore && transactions.length > 0 && (
              <Text style={styles.endText}>· All transactions loaded ·</Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── Top-up modal ── */}
      <TopUpModal
        visible={topUpVisible}
        onClose={() => setTopUpVisible(false)}
        onSuccess={() => {
          ensureAndLoad();
          loadTransactions(1);
        }}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: Spacing.xl * 2,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: Typography.sm,
  },

  // Balance card
  balanceCard: {
    backgroundColor: colors.balanceBg,
    margin: Spacing.md,
    borderRadius: 20,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: Typography.sm,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  topUpBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  topUpBtnText: {
    color: colors.balanceText,
    fontSize: Typography.sm,
    fontWeight: '700',
  },
  balanceAmount: {
    color: colors.balanceText,
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: -1,
  },
  balanceSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: Typography.xs,
    marginTop: 2,
    marginBottom: Spacing.md,
  },
  balanceMeta: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    paddingTop: Spacing.sm,
  },
  balanceMetaText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: Typography.xs,
  },

  // Quick actions
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.cardBg,
    marginHorizontal: Spacing.md,
    borderRadius: 16,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  quickAction: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  quickActionIcon: {
    fontSize: 24,
  },
  quickActionLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
  },

  // Info banner
  infoBanner: {
    backgroundColor: colors.infoLight,
    marginHorizontal: Spacing.md,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  infoBannerText: {
    fontSize: Typography.xs,
    color: '#0c5460',
    lineHeight: 18,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: Typography.base,
    fontWeight: '700',
    color: Colors.text,
  },

  // Transaction list
  txList: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  txCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
    marginRight: Spacing.sm,
  },
  txTypeBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 52,
    alignItems: 'center',
  },
  txTypeText: {
    fontSize: Typography.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  txInfo: {
    flex: 1,
    gap: 2,
  },
  txDescription: {
    fontSize: Typography.sm,
    color: Colors.text,
    fontWeight: '500',
  },
  txRef: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
  },
  txDate: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
  },
  txAmount: {
    fontSize: Typography.base,
    fontWeight: '700',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl * 2,
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: Typography.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 22,
  },
  emptyAction: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  emptyActionText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: Typography.sm,
  },

  // Load more
  loadMoreBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  loadMoreText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: Typography.sm,
  },
  endText: {
    textAlign: 'center',
    color: Colors.textSecondary,
    fontSize: Typography.xs,
    paddingVertical: Spacing.md,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl + (Platform.OS === 'ios' ? 20 : 0),
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.divider,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: Typography.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    fontSize: Typography.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  quickAmountRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  quickChip: {
    borderWidth: 1.5,
    borderColor: Colors.divider,
    borderRadius: 20,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.background,
  },
  quickChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '15',
  },
  quickChipText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  quickChipTextActive: {
    color: Colors.primary,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
  },
  currencySymbol: {
    fontSize: 24,
    color: Colors.primary,
    fontWeight: '700',
    marginRight: Spacing.xs,
  },
  amountInput: {
    flex: 1,
    fontSize: 32,
    color: Colors.text,
    fontWeight: '700',
    paddingVertical: Spacing.md,
  },
  amountHint: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  errorText: {
    fontSize: Typography.sm,
    color: colors.debitRed,
    marginBottom: Spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.divider,
    borderRadius: 12,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: Typography.sm,
  },
  proceedBtn: {
    flex: 2,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  proceedBtnDisabled: {
    backgroundColor: Colors.textSecondary,
    opacity: 0.5,
  },
  proceedBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: Typography.sm,
  },
});
