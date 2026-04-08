import React, { useState, useEffect, useCallback } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    SafeAreaView, 
    FlatList, 
    TouchableOpacity, 
    ActivityIndicator,
    RefreshControl
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Bell, Receipt, Send, CheckCircle2, XCircle, Clock, CheckCheck } from 'lucide-react-native';
import { notificationsApi, NotificationOut } from '../services/api';

export default function NotificationsScreen() {
    const { colors, isDark } = useTheme();
    
    const [notifications, setNotifications] = useState<NotificationOut[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = useCallback(async () => {
        try {
            const data = await notificationsApi.list();
            setNotifications(data);
        } catch (err) {
            console.error('Failed to load notifications', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const handleMarkRead = async (id: string) => {
        // Optimistic update
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        try {
            await notificationsApi.markRead(id);
        } catch (err) {
            console.error(err);
        }
    };

    const handleMarkAllRead = async () => {
        // Optimistic update
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        try {
            await notificationsApi.markAllRead();
            loadData();
        } catch (err) {
            console.error(err);
        }
    };

    const getIconForType = (type: string) => {
        switch (type) {
            case 'expense_added':
                return { Icon: Receipt, color: '#3B82F6', bgColor: 'rgba(59, 130, 246, 0.1)' };
            case 'settlement_requested':
                return { Icon: Send, color: '#F59E0B', bgColor: 'rgba(245, 158, 11, 0.1)' };
            case 'payment_sent':
                return { Icon: Clock, color: '#8B5CF6', bgColor: 'rgba(139, 92, 246, 0.1)' };
            case 'payment_confirmed':
                return { Icon: CheckCircle2, color: '#10B981', bgColor: 'rgba(16, 185, 129, 0.1)' };
            case 'payment_declined':
                return { Icon: XCircle, color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.1)' };
            default:
                return { Icon: Bell, color: '#6366F1', bgColor: 'rgba(99, 102, 241, 0.1)' };
        }
    };

    const renderNotification = ({ item }: { item: NotificationOut }) => {
        const { Icon, color, bgColor } = getIconForType(item.type);

        return (
            <TouchableOpacity 
                style={[
                    styles.notificationCard, 
                    { backgroundColor: item.read ? colors.background : colors.surface, borderColor: colors.border }
                ]}
                onPress={() => !item.read && handleMarkRead(item.id)}
                activeOpacity={item.read ? 1 : 0.7}
            >
                <View style={[styles.iconBox, { backgroundColor: bgColor }]}>
                    <Icon size={24} color={color} />
                </View>
                <View style={styles.contentBox}>
                    <View style={styles.titleRow}>
                        <Text style={[styles.cardTitle, { color: colors.text, fontWeight: item.read ? 'normal' : 'bold' }]}>
                            {item.title}
                        </Text>
                        {!item.read && <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} />}
                    </View>
                    <Text style={[styles.cardMessage, { color: colors.secondaryText }]}>
                        {item.message}
                    </Text>
                    <Text style={[styles.timeText, { color: colors.secondaryText }]}>
                        {new Date(item.created_at).toLocaleDateString()} at {new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.title, { color: colors.text }]}>Activity</Text>
                    <Text style={[styles.subtitle, { color: colors.secondaryText }]}>Notifications & alerts</Text>
                </View>
                {notifications.some(n => !n.read) && (
                    <TouchableOpacity style={styles.clearAllBtn} onPress={handleMarkAllRead}>
                        <CheckCheck size={16} color={colors.accent} />
                        <Text style={[styles.clearAllText, { color: colors.accent }]}>Mark All Read</Text>
                    </TouchableOpacity>
                )}
            </View>

            {loading && !refreshing ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={colors.accent} />
                </View>
            ) : notifications.length === 0 ? (
                <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={[styles.emptyIconContainer, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                        <Bell size={40} color="#F59E0B" />
                    </View>
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>No new notifications</Text>
                    <Text style={[styles.emptyDesc, { color: colors.secondaryText }]}>You're all caught up! Activity will show here.</Text>
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={item => item.id}
                    renderItem={renderNotification}
                    contentContainerStyle={styles.listContainer}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 16,
    },
    title: {
        fontSize: 32,
        fontWeight: '900',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
    },
    clearAllBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        borderRadius: 8,
        gap: 4,
    },
    clearAllText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    listContainer: {
        paddingHorizontal: 24,
        paddingBottom: 140, // Space for custom tab bar
    },
    notificationCard: {
        flexDirection: 'row',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 12,
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    contentBox: {
        flex: 1,
        justifyContent: 'center',
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    cardTitle: {
        fontSize: 16,
        flex: 1,
        marginRight: 8,
    },
    unreadDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    cardMessage: {
        fontSize: 14,
        marginBottom: 8,
        lineHeight: 20,
    },
    timeText: {
        fontSize: 12,
        opacity: 0.7,
    },
    emptyState: {
        padding: 40,
        borderRadius: 24,
        borderWidth: 1,
        alignItems: 'center',
        marginHorizontal: 24,
        marginTop: 40,
    },
    emptyIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    emptyDesc: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 22,
    },
});
