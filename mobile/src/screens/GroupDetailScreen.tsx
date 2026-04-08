import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  SafeAreaView, 
  ActivityIndicator, 
  RefreshControl,
  ScrollView,
  Modal,
  Alert
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { groupsApi, expensesApi, balancesApi, settlementsApi, Group, Expense, UserBalance, Settlement } from '../services/api';
import { ArrowLeft, Plus, Users, Receipt, Send, ChevronRight, X, CheckCircle2 } from 'lucide-react-native';

export default function GroupDetailScreen({ route, navigation }: any) {
    const { groupId } = route.params;
    const { colors, isDark } = useTheme();
    const { user } = useAuth();

    const [group, setGroup] = useState<Group | null>(null);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [balances, setBalances] = useState<UserBalance[]>([]);
    const [settlements, setSettlements] = useState<Settlement[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    
    const [settleModalVisible, setSettleModalVisible] = useState(false);

    const loadData = useCallback(async () => {
        try {
            const [groupData, expensesData, balancesData, settlementsData] = await Promise.all([
                groupsApi.get(groupId),
                expensesApi.list(groupId),
                balancesApi.getBalances(groupId),
                balancesApi.getSettlements(groupId)
            ]);
            setGroup(groupData);
            setExpenses(expensesData.reverse()); // Show newest first
            setBalances(balancesData);
            setSettlements(settlementsData);
        } catch (err) {
            console.error('Failed to load group details', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [groupId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const handleInitiateSettlement = async (payeeId: string, amount: number) => {
        Alert.alert(
            "Confirm Payment",
            `Do you want to record a $${amount.toFixed(2)} payment to this user? They will receive a notification.`,
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Record Payment", 
                    style: "default",
                    onPress: async () => {
                        try {
                            await settlementsApi.create(groupId, payeeId, amount, 'in_app');
                            setSettleModalVisible(false);
                            Alert.alert("Success", "Payment initiated! Check your Payments tab.", [
                                { text: "OK", onPress: () => navigation.navigate("Payments") }
                            ]);
                        } catch (err: any) {
                            Alert.alert("Error", err.message);
                        }
                    }
                }
            ]
        );
    };

    const renderBalanceBubble = ({ item }: { item: UserBalance }) => {
        const isNegative = item.net_balance < 0;
        const bubbleColor = isNegative ? colors.danger : colors.accent;
        const bgColor = isNegative ? 'rgba(239, 68, 68, 0.1)' : 'rgba(74, 222, 128, 0.1)';

        return (
            <View style={[styles.balanceBubble, { backgroundColor: bgColor, borderColor: bubbleColor }]}>
                <View style={[styles.avatarSmall, { backgroundColor: item.avatar_color || colors.primary }]}>
                    <Text style={styles.avatarTextSmall}>{item.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View>
                    <Text style={[styles.balanceName, { color: colors.text }]} numberOfLines={1}>
                        {item.name.split(' ')[0]}
                    </Text>
                    <Text style={[styles.balanceAmount, { color: bubbleColor }]}>
                        {isNegative ? '-' : '+'}${Math.abs(item.net_balance).toFixed(2)}
                    </Text>
                </View>
            </View>
        );
    };

    const renderExpenseItem = ({ item }: { item: Expense }) => {
        return (
            <TouchableOpacity style={[styles.expenseCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.expenseIcon, { backgroundColor: item.payer_avatar_color || colors.indigo }]}>
                    <Receipt size={20} color="white" />
                </View>
                <View style={styles.expenseInfo}>
                    <Text style={[styles.expenseTitle, { color: colors.text }]}>{item.title}</Text>
                    <Text style={[styles.expenseMeta, { color: colors.secondaryText }]}>
                        Paid by {item.payer_name} • {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                </View>
                <Text style={[styles.expenseAmount, { color: colors.text }]}>
                    ${item.amount.toFixed(2)}
                </Text>
            </TouchableOpacity>
        );
    };

    if (loading && !refreshing) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.center}>
                    <ActivityIndicator color={colors.accent} size="large" />
                </View>
            </SafeAreaView>
        );
    }

    const myDebts = settlements.filter(s => s.from_user_id === user?.id);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Custom Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                        {group?.name || 'Group Details'}
                    </Text>
                </View>
                <TouchableOpacity style={styles.iconButton}>
                    <Users size={22} color={colors.secondaryText} />
                </TouchableOpacity>
            </View>

            <ScrollView 
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Stats Overview */}
                <View style={[styles.statRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.statItem}>
                        <Text style={[styles.statLabel, { color: colors.secondaryText }]}>Group Spending</Text>
                        <Text style={[styles.statValue, { color: colors.text }]}>${group?.total_expenses.toFixed(2)}</Text>
                    </View>
                    <View style={[styles.verticalDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.statItem}>
                        <Text style={[styles.statLabel, { color: colors.secondaryText }]}>Members</Text>
                        <Text style={[styles.statValue, { color: colors.text }]}>{group?.members.length}</Text>
                    </View>
                </View>

                {/* Balance Bubbles Section */}
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Balances</Text>
                    <TouchableOpacity style={styles.settleButton} onPress={() => setSettleModalVisible(true)}>
                        <Send size={14} color={colors.accent} />
                        <Text style={[styles.settleButtonText, { color: colors.accent }]}>Settle Up</Text>
                    </TouchableOpacity>
                </View>

                <FlatList
                    horizontal
                    data={balances}
                    renderItem={renderBalanceBubble}
                    keyExtractor={(item) => item.user_id}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.balanceList}
                />

                {/* Expenses History */}
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Expenses</Text>
                </View>

                {expenses.length === 0 ? (
                    <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Receipt size={40} color={colors.secondaryText} style={{ marginBottom: 12 }} />
                        <Text style={[styles.emptyText, { color: colors.secondaryText }]}>No expenses yet.</Text>
                    </View>
                ) : (
                    expenses.map((expense) => (
                        <View key={expense.id}>
                            {renderExpenseItem({ item: expense })}
                        </View>
                    ))
                )}
            </ScrollView>

            {/* Combined Add FAB */}
            <TouchableOpacity 
                style={[styles.fab, { backgroundColor: colors.accent, shadowColor: colors.accent }]}
            >
                <Plus size={28} color="white" />
            </TouchableOpacity>

            {/* SETTLE UP MODAL */}
            <Modal visible={settleModalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>Settle Up</Text>
                            <TouchableOpacity onPress={() => setSettleModalVisible(false)} style={[styles.closeModalBtn, { backgroundColor: colors.border }]}>
                                <X size={20} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        {myDebts.length === 0 ? (
                            <View style={{ alignItems: 'center', padding: 20 }}>
                                <CheckCircle2 size={48} color={colors.accent} style={{ marginBottom: 16 }} />
                                <Text style={[styles.modalTitle, { color: colors.text, textAlign: 'center' }]}>You're all settled up!</Text>
                                <Text style={{ color: colors.secondaryText, textAlign: 'center', marginTop: 8 }}>You don't owe any money in this group.</Text>
                            </View>
                        ) : (
                            <>
                                <Text style={{ color: colors.secondaryText, marginBottom: 16 }}>Select a balance to pay:</Text>
                                <ScrollView>
                                    {myDebts.map((debt, idx) => (
                                        <TouchableOpacity 
                                            key={idx} 
                                            style={[styles.debtCard, { backgroundColor: colors.background, borderColor: colors.border }]}
                                            onPress={() => handleInitiateSettlement(debt.to_user_id, debt.amount)}
                                        >
                                            <View style={[styles.debtAvatar, { backgroundColor: debt.to_avatar_color }]}>
                                                <Text style={{ color: 'white', fontWeight: 'bold' }}>{debt.to_user_name.charAt(0).toUpperCase()}</Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ color: colors.secondaryText, fontSize: 13 }}>Pay</Text>
                                                <Text style={{ color: colors.text, fontSize: 16, fontWeight: 'bold' }}>{debt.to_user_name}</Text>
                                            </View>
                                            <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: 12 }}>
                                                <Text style={{ color: colors.danger, fontSize: 18, fontWeight: '900' }}>${debt.amount.toFixed(2)}</Text>
                                                <ChevronRight size={20} color={colors.secondaryText} />
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </>
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    backButton: { padding: 4 },
    headerTitleContainer: { flex: 1, marginHorizontal: 12 },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    iconButton: { padding: 4 },
    scrollContent: { paddingBottom: 100 },
    statRow: {
        flexDirection: 'row',
        margin: 20,
        padding: 20,
        borderRadius: 24,
        borderWidth: 1,
        alignItems: 'center',
    },
    statItem: { flex: 1, alignItems: 'center' },
    verticalDivider: { width: 1, height: 40 },
    statLabel: { fontSize: 12, marginBottom: 4, fontWeight: '500' },
    statValue: { fontSize: 24, fontWeight: '900' },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 16,
        marginTop: 8,
    },
    sectionTitle: { fontSize: 18, fontWeight: 'bold' },
    settleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: 'rgba(74, 222, 128, 0.05)',
    },
    settleButtonText: { fontSize: 13, fontWeight: '600' },
    balanceList: { paddingHorizontal: 20, gap: 12, marginBottom: 24 },
    balanceBubble: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1.5,
        gap: 10,
        minWidth: 120,
    },
    avatarSmall: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarTextSmall: { color: 'white', fontSize: 12, fontWeight: 'bold' },
    balanceName: { fontSize: 13, fontWeight: 'bold', maxWidth: 80 },
    balanceAmount: { fontSize: 12, fontWeight: '800' },
    expenseCard: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 20,
        marginBottom: 12,
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
    },
    expenseIcon: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    expenseInfo: { flex: 1 },
    expenseTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
    expenseMeta: { fontSize: 12 },
    expenseAmount: { fontSize: 16, fontWeight: 'bold' },
    emptyState: {
        marginHorizontal: 20,
        padding: 40,
        borderRadius: 24,
        borderWidth: 1,
        alignItems: 'center',
    },
    emptyText: { fontSize: 14 },
    fab: {
        position: 'absolute',
        bottom: 32,
        right: 24,
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 10,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
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
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
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
    debtCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 12,
    },
    debtAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    }
});
