import React, { useState, useEffect, useCallback } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    SafeAreaView, 
    ScrollView, 
    TouchableOpacity, 
    ActivityIndicator,
    Alert,
    RefreshControl,
    Modal,
    TextInput
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Send, CheckCircle2, XCircle, Clock, Check, Wallet, Landmark, CreditCard, Plus, ArrowDownToLine, X, RotateCcw } from 'lucide-react-native';
import { meApi, settlementsApi, SettlementRecordOut, walletApi, WalletTransactionOut, User } from '../services/api';

export default function PaymentsScreen() {
    const { colors, isDark } = useTheme();
    const { user } = useAuth();
    
    const [masterTab, setMasterTab] = useState<'wallet' | 'settle'>('wallet');
    const [settleTab, setSettleTab] = useState<'pending' | 'history'>('pending');
    
    const [payments, setPayments] = useState<SettlementRecordOut[]>([]);
    const [walletBalance, setWalletBalance] = useState<number>(0);
    const [walletTransactions, setWalletTransactions] = useState<WalletTransactionOut[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Modal state for Add Funds / Withdraw
    const [fundModalVisible, setFundModalVisible] = useState(false);
    const [fundModalType, setFundModalType] = useState<'add' | 'withdraw'>('add');
    const [fundAmount, setFundAmount] = useState('');
    const [fundLoading, setFundLoading] = useState(false);

    const loadData = useCallback(async () => {
        try {
            if (masterTab === 'settle') {
                const data = await meApi.getPayments();
                setPayments(data);
            } else {
                const [balanceData, txData] = await Promise.all([
                    walletApi.getBalance(),
                    walletApi.getTransactions()
                ]);
                setWalletBalance(balanceData.wallet_balance || 0);
                setWalletTransactions(txData);
            }
        } catch (err) {
            console.error('Failed to load data', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [masterTab]);

    useEffect(() => {
        setLoading(true);
        loadData();
    }, [loadData]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const handleUpdateStatus = async (groupId: string, id: string, status: string) => {
        try {
            await settlementsApi.updateStatus(groupId, id, status);
            loadData();
        } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to update payment.");
        }
    };

    const handleWalletAction = async () => {
        const amt = parseFloat(fundAmount);
        if (isNaN(amt) || amt <= 0) {
            Alert.alert("Invalid Amount", "Please enter a valid amount greater than 0.");
            return;
        }

        setFundLoading(true);
        try {
            if (fundModalType === 'add') {
                await walletApi.addFunds(amt);
            } else {
                await walletApi.withdraw(amt);
            }
            setFundModalVisible(false);
            setFundAmount('');
            loadData();
            Alert.alert("Success", fundModalType === 'add' ? "Funds added successfully." : "Withdrawal initiated.");
        } catch (err: any) {
            Alert.alert("Error", err.message || "Wallet action failed.");
        } finally {
            setFundLoading(false);
        }
    };

    const openFundModal = (type: 'add' | 'withdraw') => {
        setFundModalType(type);
        setFundAmount('');
        setFundModalVisible(true);
    };

    const handleMockConnect = (service: string) => {
        Alert.alert(`${service} Connect`, `Connecting to ${service} is limited in the Expo Go environment. Use the Web App at tandempay.ca to link securely.`);
    };

    const renderInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    };

    // Filter payments
    const pendingPayments = payments.filter(p => p.status === 'pending' || p.status === 'sent');
    const historyPayments = payments.filter(p => p.status === 'settled' || p.status === 'declined');

    const renderPaymentCard = (payment: SettlementRecordOut) => {
        const isPayer = payment.payer_id === user?.id;
        const otherUserType = isPayer ? 'Paying' : 'Receiving from';
        const otherUserName = isPayer ? payment.payee_name : payment.payer_name;
        const otherUserAvatar = isPayer ? payment.payee_avatar_color : payment.payer_avatar_color;

        return (
            <View key={payment.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                    <View style={styles.cardInfo}>
                        <View style={[styles.avatar, { backgroundColor: otherUserAvatar }]}>
                            <Text style={styles.avatarText}>{renderInitials(otherUserName)}</Text>
                        </View>
                        <View>
                            <Text style={[styles.cardTitle, { color: colors.secondaryText }]}>{otherUserType}</Text>
                            <Text style={[styles.cardName, { color: colors.text }]}>{otherUserName}</Text>
                        </View>
                    </View>
                    <Text style={[styles.amount, { color: isPayer ? colors.danger : colors.accent }]}>
                        ${parseFloat(payment.amount.toString()).toFixed(2)}
                    </Text>
                </View>

                {/* Status Indicator */}
                <View style={[styles.statusBanner, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }]}>
                    <Text style={[styles.statusText, { color: colors.text }]}>
                        Status: <Text style={{ fontWeight: 'bold', color: payment.status === 'settled' ? colors.accent : payment.status === 'declined' ? colors.danger : colors.secondaryText }}>{payment.status.toUpperCase()}</Text>
                    </Text>
                </View>

                {/* Actions */}
                {settleTab === 'pending' && (
                    <View style={styles.actions}>
                        {isPayer && payment.status === 'pending' && (
                            <TouchableOpacity 
                                style={[styles.actionBtn, { backgroundColor: colors.accent }]}
                                onPress={() => handleUpdateStatus(payment.group_id, payment.id, 'sent')}
                            >
                                <Send size={16} color="white" />
                                <Text style={styles.actionText}>Mark as Sent</Text>
                            </TouchableOpacity>
                        )}
                        {isPayer && payment.status === 'sent' && (
                            <Text style={[styles.waitingText, { color: colors.secondaryText }]}>
                                <Clock size={14} color={colors.secondaryText} style={{ marginRight: 4 }}/> Waiting for them to confirm...
                            </Text>
                        )}

                        {!isPayer && payment.status === 'pending' && (
                            <Text style={[styles.waitingText, { color: colors.secondaryText }]}>
                                <Clock size={14} color={colors.secondaryText} style={{ marginRight: 4 }}/> Waiting for them to send money...
                            </Text>
                        )}
                        {!isPayer && payment.status === 'sent' && (
                            <View style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
                                <TouchableOpacity 
                                    style={[styles.actionBtn, { backgroundColor: colors.accent, flex: 2 }]}
                                    onPress={() => handleUpdateStatus(payment.group_id, payment.id, 'settled')}
                                >
                                    <CheckCircle2 size={16} color="white" />
                                    <Text style={styles.actionText}>Confirm</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.actionBtn, { backgroundColor: colors.danger, flex: 1 }]}
                                    onPress={() => handleUpdateStatus(payment.group_id, payment.id, 'declined')}
                                >
                                    <XCircle size={16} color="white" />
                                    <Text style={styles.actionText}>Decline</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                )}
            </View>
        );
    };

    const renderWalletTransaction = (tx: WalletTransactionOut) => {
        const isPositive = tx.amount > 0;
        return (
            <View key={tx.id} style={[styles.ledgerRow, { borderBottomColor: colors.border }]}>
                <View style={[styles.ledgerIcon, { backgroundColor: isPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }]}>
                    {isPositive ? <ArrowDownToLine size={16} color="#10B981" /> : <Clock size={16} color="#EF4444" />}
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.ledgerType, { color: colors.text }]}>{tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}</Text>
                    <Text style={[styles.ledgerDate, { color: colors.secondaryText }]}>
                        {new Date(tx.created_at).toLocaleDateString()}
                    </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.ledgerAmount, { color: isPositive ? colors.accent : colors.text }]}>
                        {isPositive ? '+' : ''}${Math.abs(tx.amount).toFixed(2)}
                    </Text>
                    <Text style={[styles.ledgerStatus, { color: tx.status === 'completed' ? colors.accent : '#F59E0B' }]}>
                        {tx.status.toUpperCase()}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text }]}>Payments & Wallet</Text>
                
                {/* Master Segmented Control */}
                <View style={[styles.segmentContainer, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 16 }]}>
                    <TouchableOpacity 
                        style={[styles.segment, masterTab === 'wallet' && { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'white', shadowOpacity: masterTab === 'wallet' ? 0.1 : 0 }]}
                        onPress={() => setMasterTab('wallet')}
                    >
                        <Wallet size={16} color={masterTab === 'wallet' ? colors.text : colors.secondaryText} style={{ marginRight: 6 }} />
                        <Text style={[styles.segmentText, { color: masterTab === 'wallet' ? colors.text : colors.secondaryText, fontWeight: masterTab === 'wallet' ? 'bold' : 'normal' }]}>Wallet</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.segment, masterTab === 'settle' && { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'white', shadowOpacity: masterTab === 'settle' ? 0.1 : 0 }]}
                        onPress={() => setMasterTab('settle')}
                    >
                        <Send size={16} color={masterTab === 'settle' ? colors.text : colors.secondaryText} style={{ marginRight: 6 }} />
                        <Text style={[styles.segmentText, { color: masterTab === 'settle' ? colors.text : colors.secondaryText, fontWeight: masterTab === 'settle' ? 'bold' : 'normal' }]}>Settle Up</Text>
                    </TouchableOpacity>
                </View>

                {/* Sub Segmented Control (Only for Settle Up) */}
                {masterTab === 'settle' && (
                    <View style={[styles.segmentContainer, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 8 }]}>
                        <TouchableOpacity 
                            style={[styles.segment, settleTab === 'pending' && { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'white', shadowOpacity: settleTab === 'pending' ? 0.1 : 0 }]}
                            onPress={() => setSettleTab('pending')}
                        >
                            <Text style={[styles.segmentText, { color: settleTab === 'pending' ? colors.text : colors.secondaryText, fontWeight: settleTab === 'pending' ? 'bold' : 'normal' }]}>Action Required</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.segment, settleTab === 'history' && { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'white', shadowOpacity: settleTab === 'history' ? 0.1 : 0 }]}
                            onPress={() => setSettleTab('history')}
                        >
                            <Text style={[styles.segmentText, { color: settleTab === 'history' ? colors.text : colors.secondaryText, fontWeight: settleTab === 'history' ? 'bold' : 'normal' }]}>History</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            <ScrollView 
                contentContainerStyle={styles.container}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
            >
                {loading && !refreshing ? (
                    <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
                ) : masterTab === 'settle' ? (
                    <>
                        {(settleTab === 'pending' ? pendingPayments : historyPayments).length === 0 ? (
                            <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <View style={[styles.iconContainer, { backgroundColor: 'rgba(52, 211, 153, 0.1)' }]}>
                                    {settleTab === 'pending' ? <Send size={40} color="#34D399" /> : <Check size={40} color="#34D399" />}
                                </View>
                                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                                    {settleTab === 'pending' ? 'All caught up!' : 'No payment history'}
                                </Text>
                                <Text style={[styles.emptyDesc, { color: colors.secondaryText }]}>
                                    {settleTab === 'pending' ? 'You have no pending settlement requests.' : 'Past payments will appear here.'}
                                </Text>
                            </View>
                        ) : (
                            (settleTab === 'pending' ? pendingPayments : historyPayments).map(renderPaymentCard)
                        )}
                    </>
                ) : (
                    // WALLET VIEW
                    <>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.walletCardsScroll}>
                            {/* Balance Card */}
                            <View style={[styles.walletCard, { backgroundColor: '#E0E7FF', borderColor: '#C7D2FE' }]}>
                                <View style={styles.walletCardHeader}>
                                    <View style={[styles.walletIconBox, { backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}>
                                        <Wallet size={20} color="#4F46E5" />
                                    </View>
                                    <Text style={styles.walletCardTitle}>Tandem Balance</Text>
                                </View>
                                <Text style={styles.walletAvailable}>Available Funds</Text>
                                <Text style={styles.walletBalanceText}>${walletBalance.toFixed(2)}</Text>
                                <View style={styles.walletButtons}>
                                    <TouchableOpacity style={[styles.walletBtn, { backgroundColor: 'white' }]} onPress={() => openFundModal('add')}>
                                        <Text style={[styles.walletBtnText, { color: '#4F46E5' }]}>Add Funds</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.walletBtn, { backgroundColor: '#818CF8' }]} onPress={() => openFundModal('withdraw')}>
                                        <Text style={[styles.walletBtnText, { color: 'white' }]}>Withdraw</Text>
                                    </TouchableOpacity>
                                </View>
                                <Text style={styles.walletPowered}>Powered by Tandem Ledger</Text>
                            </View>

                            {/* Plaid Linked Accounts Card */}
                            <View style={[styles.walletCard, { backgroundColor: isDark ? colors.surface : 'white', borderColor: colors.border }]}>
                                <View style={[styles.walletIconBox, { backgroundColor: 'rgba(107, 114, 128, 0.1)', alignSelf: 'center', marginBottom: 12 }]}>
                                    <Landmark size={24} color="#6B7280" />
                                </View>
                                <Text style={[styles.walletCardTitle, { color: colors.text, textAlign: 'center', marginBottom: 8 }]}>Linked Accounts</Text>
                                <Text style={[styles.walletDesc, { color: colors.secondaryText }]}>Connect your bank to add funds or withdraw your balance securely.</Text>
                                <TouchableOpacity style={[styles.walletBtnFull, { backgroundColor: '#4F46E5', marginTop: 'auto' }]} onPress={() => handleMockConnect('Plaid')}>
                                    <Landmark size={14} color="white" style={{ marginRight: 6 }} />
                                    <Text style={[styles.walletBtnText, { color: 'white' }]}>Link Bank Account</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Stripe Receiving Card */}
                            <View style={[styles.walletCard, { backgroundColor: isDark ? colors.surface : 'white', borderColor: colors.border }]}>
                                <View style={[styles.walletIconBox, { backgroundColor: 'rgba(99, 102, 241, 0.1)', alignSelf: 'center', marginBottom: 12 }]}>
                                    <CreditCard size={24} color="#6366F1" />
                                </View>
                                <Text style={[styles.walletCardTitle, { color: colors.text, textAlign: 'center', marginBottom: 8 }]}>Receive Payments</Text>
                                <Text style={[styles.walletDesc, { color: colors.secondaryText }]}>Connect your bank with Stripe to receive instant payouts from friends.</Text>
                                <TouchableOpacity style={[styles.walletBtnFull, { backgroundColor: '#6366F1', marginTop: 'auto' }]} onPress={() => handleMockConnect('Stripe')}>
                                    <Text style={[styles.walletBtnText, { color: 'white' }]}>Connect Stripe ↗</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>

                        <Text style={[styles.ledgerSectionTitle, { color: colors.text }]}>
                            <RotateCcw size={16} color={colors.secondaryText} style={{ marginRight: 8 }} />
                            Ledger History
                        </Text>
                        
                        <View style={[styles.ledgerContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            {walletTransactions.length === 0 ? (
                                <View style={styles.ledgerEmpty}>
                                    <RotateCcw size={32} color={colors.secondaryText} />
                                    <Text style={[styles.ledgerEmptyText, { color: colors.secondaryText }]}>No transactions yet.</Text>
                                </View>
                            ) : (
                                walletTransactions.map(renderWalletTransaction)
                            )}
                        </View>
                    </>
                )}
            </ScrollView>

            {/* FUND MODAL */}
            <Modal visible={fundModalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>
                                {fundModalType === 'add' ? 'Add Funds' : 'Withdraw Funds'}
                            </Text>
                            <TouchableOpacity onPress={() => setFundModalVisible(false)} style={[styles.closeModalBtn, { backgroundColor: colors.border }]}>
                                <X size={20} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        <Text style={{ color: colors.secondaryText, marginBottom: 16 }}>
                            {fundModalType === 'add' ? 'Enter amount to deposit into your Tandem wallet.' : `Enter amount to withdraw. Available: $${walletBalance.toFixed(2)}`}
                        </Text>

                        <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.background }]}>
                            <Text style={[styles.currencySymbol, { color: colors.text }]}>$</Text>
                            <TextInput
                                style={[styles.input, { color: colors.text }]}
                                placeholder="0.00"
                                placeholderTextColor={colors.secondaryText}
                                keyboardType="numeric"
                                value={fundAmount}
                                onChangeText={setFundAmount}
                                autoFocus
                            />
                        </View>

                        <TouchableOpacity 
                            style={[styles.submitBtn, { backgroundColor: colors.accent, opacity: fundLoading ? 0.7 : 1 }]}
                            onPress={handleWalletAction}
                            disabled={fundLoading}
                        >
                            {fundLoading ? <ActivityIndicator color="white" /> : <Text style={styles.submitBtnText}>Confirm</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    header: {
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 8,
    },
    title: {
        fontSize: 32,
        fontWeight: '900',
        marginBottom: 20,
    },
    segmentContainer: {
        flexDirection: 'row',
        padding: 4,
        borderRadius: 12,
        borderWidth: 1,
    },
    segment: {
        flex: 1,
        flexDirection: 'row',
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
    },
    segmentText: {
        fontSize: 14,
    },
    container: {
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 140,
    },
    
    // Settle Up Styles
    card: {
        borderRadius: 20,
        borderWidth: 1,
        marginBottom: 16,
        padding: 16,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cardInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    avatarText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    cardTitle: { fontSize: 12, marginBottom: 2 },
    cardName: { fontSize: 16, fontWeight: 'bold' },
    amount: { fontSize: 22, fontWeight: '900' },
    statusBanner: {
        marginTop: 16,
        padding: 12,
        borderRadius: 12,
    },
    statusText: { fontSize: 13 },
    actions: {
        marginTop: 16,
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 48,
        borderRadius: 12,
        width: '100%',
    },
    actionText: { color: 'white', fontWeight: 'bold', fontSize: 15 },
    waitingText: { fontSize: 14, fontStyle: 'italic', textAlign: 'center', width: '100%' },
    emptyState: {
        padding: 40,
        borderRadius: 24,
        borderWidth: 1,
        alignItems: 'center',
        marginTop: 20,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    emptyTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
    emptyDesc: { fontSize: 14, textAlign: 'center', lineHeight: 22 },

    // Wallet Styles
    walletCardsScroll: {
        paddingBottom: 24,
        gap: 16,
    },
    walletCard: {
        width: 280,
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        marginRight: 16, // using marginRight here because gap sometimes acts up in horizontal scrollviews on old RN
    },
    walletCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    walletIconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    walletCardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111827',
    },
    walletAvailable: {
        fontSize: 13,
        color: '#4B5563',
        marginBottom: 4,
    },
    walletBalanceText: {
        fontSize: 36,
        fontWeight: '900',
        color: '#111827',
        marginBottom: 24,
    },
    walletButtons: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    walletBtn: {
        flex: 1,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    walletBtnFull: {
        flexDirection: 'row',
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    walletBtnText: {
        fontSize: 13,
        fontWeight: 'bold',
    },
    walletPowered: {
        fontSize: 11,
        color: '#6B7280',
        textAlign: 'center',
    },
    walletDesc: {
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 20,
    },
    ledgerSectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
    },
    ledgerContainer: {
        borderRadius: 20,
        borderWidth: 1,
        overflow: 'hidden',
    },
    ledgerEmpty: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ledgerEmptyText: {
        marginTop: 12,
        fontSize: 14,
    },
    ledgerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
    },
    ledgerIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    ledgerType: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    ledgerDate: {
        fontSize: 12,
    },
    ledgerAmount: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    ledgerStatus: {
        fontSize: 11,
        fontWeight: 'bold',
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        minHeight: '40%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: '900',
    },
    closeModalBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 2,
        borderRadius: 16,
        paddingHorizontal: 16,
        marginBottom: 24,
        height: 60,
    },
    currencySymbol: {
        fontSize: 24,
        fontWeight: 'bold',
        marginRight: 8,
    },
    input: {
        flex: 1,
        fontSize: 24,
        fontWeight: 'bold',
    },
    submitBtn: {
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    submitBtnText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    }
});
