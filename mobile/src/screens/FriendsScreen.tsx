import React, { useState, useEffect } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    SafeAreaView, 
    ScrollView, 
    TextInput, 
    TouchableOpacity, 
    ActivityIndicator, 
    Alert 
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Users, MailPlus, UserCheck, UserX, Clock } from 'lucide-react-native';
import { friendsApi, Friend, PendingRequests, FriendRequestOut } from '../services/api';

export default function FriendsScreen() {
    const { colors, isDark } = useTheme();
    
    const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');
    const [emailInput, setEmailInput] = useState('');
    
    const [friends, setFriends] = useState<Friend[]>([]);
    const [requests, setRequests] = useState<PendingRequests>({ sent: [], received: [] });
    
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const loadData = async () => {
        try {
            const [friendsData, requestsData] = await Promise.all([
                friendsApi.getMyFriends(),
                friendsApi.getPendingRequests()
            ]);
            setFriends(friendsData);
            setRequests(requestsData);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleSendRequest = async () => {
        if (!emailInput.trim()) return;
        setSubmitting(true);
        try {
            await friendsApi.sendRequest(emailInput.trim());
            setEmailInput('');
            Alert.alert("Success", "Friend request sent!");
            await loadData();
        } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to send request.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleAccept = async (id: string) => {
        try {
            await friendsApi.acceptRequest(id);
            await loadData();
        } catch (err: any) {
            Alert.alert("Error", err.message);
        }
    };

    const handleDecline = async (id: string) => {
        try {
            await friendsApi.declineRequest(id);
            await loadData();
        } catch (err: any) {
            Alert.alert("Error", err.message);
        }
    };

    const renderInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text }]}>Connections</Text>
                
                {/* Segmented Control */}
                <View style={[styles.segmentContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <TouchableOpacity 
                        style={[styles.segment, activeTab === 'friends' && { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'white', shadowOpacity: activeTab === 'friends' ? 0.1 : 0 }]}
                        onPress={() => setActiveTab('friends')}
                    >
                        <Text style={[styles.segmentText, { color: activeTab === 'friends' ? colors.text : colors.secondaryText, fontWeight: activeTab === 'friends' ? 'bold' : 'normal' }]}>My Friends</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.segment, activeTab === 'requests' && { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'white', shadowOpacity: activeTab === 'requests' ? 0.1 : 0 }]}
                        onPress={() => setActiveTab('requests')}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.segmentText, { color: activeTab === 'requests' ? colors.text : colors.secondaryText, fontWeight: activeTab === 'requests' ? 'bold' : 'normal' }]}>Requests</Text>
                            {requests.received.length > 0 && (
                                <View style={[styles.badge, { backgroundColor: colors.danger }]}>
                                    <Text style={styles.badgeText}>{requests.received.length}</Text>
                                </View>
                            )}
                        </View>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.container}>
                {loading ? (
                    <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
                ) : activeTab === 'friends' ? (
                    /* My Friends Tab */
                    <>
                        <View style={styles.addFriendSection}>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Add Friend by Email</Text>
                            <View style={styles.inputRow}>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                                    placeholder="friend@example.com"
                                    placeholderTextColor={colors.secondaryText}
                                    value={emailInput}
                                    onChangeText={setEmailInput}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                />
                                <TouchableOpacity 
                                    style={[styles.sendBtn, { backgroundColor: colors.accent, opacity: emailInput.length ? 1 : 0.5 }]}
                                    onPress={handleSendRequest}
                                    disabled={!emailInput.length || submitting}
                                >
                                    {submitting ? <ActivityIndicator color="white" /> : <MailPlus color={isDark ? '#064E3B' : 'white'} size={20} />}
                                </TouchableOpacity>
                            </View>
                        </View>

                        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 32 }]}>Your Network</Text>
                        {friends.length === 0 ? (
                            <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <Users size={40} color={colors.secondaryText} style={{ marginBottom: 16 }} />
                                <Text style={[styles.emptyTitle, { color: colors.text }]}>No friends yet</Text>
                                <Text style={[styles.emptyDesc, { color: colors.secondaryText }]}>Add friends using their email to make splitting easier.</Text>
                            </View>
                        ) : (
                            friends.map(friend => (
                                <View key={friend.id} style={[styles.friendCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                    <View style={[styles.avatar, { backgroundColor: friend.avatar_color }]}>
                                        <Text style={styles.avatarText}>{renderInitials(friend.name)}</Text>
                                    </View>
                                    <View style={styles.friendInfo}>
                                        <Text style={[styles.friendName, { color: colors.text }]}>{friend.name}</Text>
                                        <Text style={[styles.friendEmail, { color: colors.secondaryText }]}>{friend.email}</Text>
                                    </View>
                                </View>
                            ))
                        )}
                    </>
                ) : (
                    /* Requests Tab */
                    <>
                        {requests.received.length > 0 && (
                            <View style={{ marginBottom: 32 }}>
                                <Text style={[styles.sectionTitle, { color: colors.text }]}>Received Requests</Text>
                                {requests.received.map(req => (
                                    <View key={req.id} style={[styles.friendCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                        <View style={[styles.avatar, { backgroundColor: req.sender_avatar }]}>
                                            <Text style={styles.avatarText}>{renderInitials(req.sender_name)}</Text>
                                        </View>
                                        <View style={styles.friendInfo}>
                                            <Text style={[styles.friendName, { color: colors.text }]}>{req.sender_name}</Text>
                                            <Text style={[styles.friendEmail, { color: colors.secondaryText }]}>{req.sender_email}</Text>
                                        </View>
                                        <View style={styles.actionBtns}>
                                            <TouchableOpacity onPress={() => handleAccept(req.id)} style={[styles.iconBtn, { backgroundColor: 'rgba(74, 222, 128, 0.2)' }]}>
                                                <UserCheck size={20} color="#16A34A" />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => handleDecline(req.id)} style={[styles.iconBtn, { backgroundColor: 'rgba(239, 68, 68, 0.2)', marginLeft: 8 }]}>
                                                <UserX size={20} color="#DC2626" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}

                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Sent Requests</Text>
                        {requests.sent.length === 0 ? (
                            <Text style={{ color: colors.secondaryText, marginTop: 8 }}>No pending sent requests.</Text>
                        ) : (
                            requests.sent.map(req => (
                                <View key={req.id} style={[styles.friendCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                    <View style={[styles.avatar, { backgroundColor: colors.border }]}>
                                        <Clock size={20} color={colors.secondaryText} />
                                    </View>
                                    <View style={styles.friendInfo}>
                                        <Text style={[styles.friendName, { color: colors.text }]}>{req.receiver_email}</Text>
                                        <Text style={[styles.friendEmail, { color: colors.secondaryText }]}>Pending acceptance...</Text>
                                    </View>
                                </View>
                            ))
                        )}
                        
                        {requests.received.length === 0 && requests.sent.length === 0 && (
                            <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 24 }]}>
                                <MailPlus size={40} color={colors.secondaryText} style={{ marginBottom: 16 }} />
                                <Text style={[styles.emptyTitle, { color: colors.text }]}>No pending requests</Text>
                            </View>
                        )}
                    </>
                )}
            </ScrollView>
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
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
    },
    segmentText: {
        fontSize: 14,
    },
    badge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
    },
    badgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
    },
    container: {
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 140,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    addFriendSection: {
        marginBottom: 8,
    },
    inputRow: {
        flexDirection: 'row',
        gap: 12,
    },
    input: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 52,
        fontSize: 16,
    },
    sendBtn: {
        width: 52,
        height: 52,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    friendCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 12,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    avatarText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 18,
    },
    friendInfo: {
        flex: 1,
    },
    friendName: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    friendEmail: {
        fontSize: 14,
    },
    actionBtns: {
        flexDirection: 'row',
    },
    iconBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyState: {
        padding: 40,
        borderRadius: 24,
        borderWidth: 1,
        alignItems: 'center',
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    emptyDesc: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 22,
    },
});
