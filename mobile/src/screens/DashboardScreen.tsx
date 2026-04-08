import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator, RefreshControl, StatusBar } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { groupsApi, GroupListItem } from '../services/api';
import { LogOut, Plus, Users, ArrowRight, HelpCircle } from 'lucide-react-native';
import ThemeToggle from '../components/ThemeToggle';

export default function DashboardScreen({ navigation }: any) {
    const { user, logout } = useAuth();
    const { colors, isDark } = useTheme();
    const [groups, setGroups] = useState<GroupListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadGroups = async () => {
        try {
            const data = await groupsApi.list();
            setGroups(data || []);
        } catch (err) {
            console.log('Failed to load groups', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            loadGroups();
        });
        return unsubscribe;
    }, [navigation]);

    const onRefresh = () => {
        setRefreshing(true);
        loadGroups();
    };

    const totalSpending = groups.reduce((acc, g) => acc + (Number(g.total_expenses) || 0), 0);

    const renderGroup = ({ item }: { item: GroupListItem }) => {
        // Deterministic dark color based on group ID
        const palette = isDark 
            ? ['#1e1b4b', '#064e3b', '#451a03', '#3b0764', '#0f172a']
            : ['#EEF2FF', '#ECFDF5', '#FFF7ED', '#FAF5FF', '#F8FAFC'];
        const textPalette = isDark ? '#F5F7FA' : '#1E293B';
        
        const num = Array.from(item.id.toString()).reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const bgColor = palette[num % palette.length];

        const date = new Date(item.created_at);
        const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        return (
            <TouchableOpacity
                style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => navigation.navigate('Group', { groupId: item.id })}
                activeOpacity={0.8}
            >
                <View style={[styles.groupIcon, { backgroundColor: bgColor }]}>
                    <Users color={isDark ? '#F5F7FA' : colors.accent} size={24} />
                </View>
                <View style={styles.groupInfo}>
                    <Text style={[styles.groupName, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[styles.groupMeta, { color: colors.secondaryText }]}>{item.member_count} members • {formattedDate}</Text>
                </View>
                <View style={styles.groupAmountContainer}>
                    <Text style={[styles.groupAmount, { color: colors.text }]}>${(Number(item.total_expenses) || 0).toFixed(2)}</Text>
                    <ArrowRight color={colors.secondaryText} size={16} />
                </View>
            </TouchableOpacity>
        );
    };

    if (loading && !refreshing) {
        return (
            <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
                <View style={styles.center}>
                    <ActivityIndicator color={colors.accent} size="large" />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <View>
                    <Text style={[styles.greeting, { color: colors.text }]}>Hello, {user?.name.split(' ')[0]}</Text>
                    <Text style={[styles.subtitle, { color: colors.secondaryText }]}>Here is your summary</Text>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity onPress={() => navigation.navigate('Tutorial')} style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <HelpCircle color={colors.secondaryText} size={20} />
                    </TouchableOpacity>
                    <ThemeToggle />
                    <TouchableOpacity onPress={logout} style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <LogOut color={colors.danger} size={20} />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.statsContainer}>
                <View style={[styles.statCardPrimary, { backgroundColor: colors.surface, borderColor: isDark ? 'rgba(74, 222, 128, 0.2)' : 'rgba(22, 163, 74, 0.2)' }]}>
                    <Text style={[styles.statLabelPrimary, { color: colors.accent }]}>Total Spending</Text>
                    <Text style={[styles.statValuePrimary, { color: colors.text }]}>${totalSpending.toFixed(2)}</Text>
                </View>
                <View style={styles.statRow}>
                    <View style={[styles.statCardSecondary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[styles.statLabelSecondary, { color: colors.secondaryText }]}>Active Groups</Text>
                        <Text style={[styles.statValueSecondary, { color: colors.text }]}>{groups.length}</Text>
                    </View>
                    <View style={[styles.statCardSecondary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[styles.statLabelSecondary, { color: colors.secondaryText }]}>Avg / Group</Text>
                        <Text style={[styles.statValueSecondary, { color: colors.text }]}>
                            ${groups.length ? (totalSpending / groups.length).toFixed(2) : '0.00'}
                        </Text>
                    </View>
                </View>
            </View>

            <View style={styles.listHeader}>
                <Text style={[styles.listTitle, { color: colors.text }]}>Your Groups</Text>
            </View>

            <FlatList
                data={groups}
                keyExtractor={(item) => item.id}
                renderItem={renderGroup}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
                }
                ListEmptyComponent={
                    <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Users color={colors.secondaryText} size={48} style={{ marginBottom: 16 }} />
                        <Text style={[styles.emptyTitle, { color: colors.text }]}>No groups yet</Text>
                        <Text style={[styles.emptySubtitle, { color: colors.secondaryText }]}>Create a group to start tracking expenses.</Text>
                    </View>
                }
            />

            <TouchableOpacity
                style={[styles.fab, { backgroundColor: colors.accent, shadowColor: colors.accent }]}
            // Later: onPress={() => setModalVisible(true)}
            >
                <Plus color={isDark ? "#064E3B" : "white"} size={28} />
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 16,
    },
    headerActions: {
        flexDirection: 'row',
        gap: 8,
    },
    greeting: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
    },
    iconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    statsContainer: {
        paddingHorizontal: 24,
        marginBottom: 24,
    },
    statCardPrimary: {
        borderRadius: 24,
        padding: 24,
        marginBottom: 12,
        borderWidth: 1,
    },
    statLabelPrimary: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    statValuePrimary: {
        fontSize: 40,
        fontWeight: '900',
        letterSpacing: -1,
    },
    statRow: {
        flexDirection: 'row',
        gap: 12,
    },
    statCardSecondary: {
        flex: 1,
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
    },
    statLabelSecondary: {
        fontSize: 12,
        marginBottom: 8,
    },
    statValueSecondary: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    listHeader: {
        paddingHorizontal: 24,
        marginBottom: 16,
    },
    listTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    listContent: {
        paddingHorizontal: 24,
        paddingBottom: 140, // accommodate fab and custom tab bar
    },
    groupCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
    },
    groupIcon: {
        width: 48,
        height: 48,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    groupInfo: {
        flex: 1,
    },
    groupName: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    groupMeta: {
        fontSize: 12,
    },
    groupAmountContainer: {
        alignItems: 'flex-end',
        flexDirection: 'row',
        gap: 8,
    },
    groupAmount: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
        borderRadius: 24,
        borderWidth: 1,
        marginTop: 12,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        textAlign: 'center',
    },
    fab: {
        position: 'absolute',
        bottom: 100, // Move above the bottom tab bar
        right: 24,
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 10,
    },
});

