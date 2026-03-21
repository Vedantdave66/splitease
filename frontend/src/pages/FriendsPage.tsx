import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Users, Search, UserPlus, Bell, Clock, Send, Check, X, ShieldAlert, CheckCheck, Receipt, Handshake, Mail } from 'lucide-react';
import { meApi, Friend, notificationsApi, AppNotification, friendRequestsApi, FriendRequest, usersApi } from '../services/api';
import Avatar from '../components/Avatar';

export default function FriendsPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'my-friends';
    const navigate = useNavigate();

    // Data states
    const [friends, setFriends] = useState<Friend[]>([]);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [pendingRequests, setPendingRequests] = useState<{ sent: FriendRequest[], received: FriendRequest[] }>({ sent: [], received: [] });

    // UI states
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [addEmail, setAddEmail] = useState('');
    const [addLoading, setAddLoading] = useState(false);
    const [addMessage, setAddMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        loadTabData();
    }, [activeTab]);

    const loadTabData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'my-friends') {
                const data = await meApi.getFriends();
                setFriends(data);
            } else if (activeTab === 'activity') {
                const data = await notificationsApi.list();
                setNotifications(data);
            } else if (activeTab === 'pending') {
                const data = await friendRequestsApi.getPending();
                setPendingRequests(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleTabChange = (tab: string) => {
        setSearchParams({ tab });
        setSearchQuery('');
    };

    // --- Tab 1: Activity (Notifications) Logic ---
    const handleMarkAllRead = async () => {
        await notificationsApi.markAllRead();
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const handleNotificationClick = async (notif: AppNotification) => {
        if (!notif.read) {
            await notificationsApi.markRead(notif.id);
            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
        }
        if (notif.group_id) {
            navigate(`/groups/${notif.group_id}`);
        } else if (notif.type === 'friend_request') {
            handleTabChange('pending');
        }
    };

    const getNotifIcon = (type: string) => {
        switch (type) {
            case 'expense_added': return <Receipt className="w-5 h-5 text-accent" />;
            case 'settlement_requested': return <Handshake className="w-5 h-5 text-indigo-400" />;
            case 'payment_sent': return <Send className="w-5 h-5 text-amber-400" />;
            case 'payment_confirmed': return <CheckCheck className="w-5 h-5 text-accent" />;
            case 'payment_declined': return <ShieldAlert className="w-5 h-5 text-red-500" />;
            case 'member_added': return <UserPlus className="w-5 h-5 text-indigo-400" />;
            case 'friend_request': return <UserPlus className="w-5 h-5 text-accent" />;
            case 'friend_accepted': return <Check className="w-5 h-5 text-accent" />;
            default: return <Bell className="w-5 h-5 text-white/50" />;
        }
    };

    const getTimeAgo = (dateStr: string) => {
        const diffMin = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 60000);
        if (diffMin < 1) return 'Just now';
        if (diffMin < 60) return `${diffMin}m ago`;
        if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
        return `${Math.floor(diffMin / 1440)}d ago`;
    };

    // --- Tab 3: Pending Requests Logic ---
    const handleAcceptRequest = async (id: string) => {
        try {
            await friendRequestsApi.accept(id);
            loadTabData(); // Reload the list
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeclineRequest = async (id: string) => {
        try {
            await friendRequestsApi.decline(id);
            loadTabData();
        } catch (err) {
            console.error(err);
        }
    };

    // --- Tab 4: Add Friend Logic ---
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    useEffect(() => {
        if (addEmail.length < 2) {
            setSuggestions([]);
            return;
        }

        const delayDebounce = setTimeout(async () => {
            try {
                const results = await usersApi.search(addEmail);
                setSuggestions(results);
                setShowSuggestions(true);
            } catch (err) {
                console.error(err);
            }
        }, 500);

        return () => clearTimeout(delayDebounce);
    }, [addEmail]);

    const handleAddFriend = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddLoading(true);
        setAddMessage(null);
        try {
            await friendRequestsApi.send(addEmail);
            setAddMessage({ type: 'success', text: 'Friend request sent successfully!' });
            setAddEmail('');
            setSuggestions([]);
            setShowSuggestions(false);
        } catch (err: any) {
            setAddMessage({ type: 'error', text: err.message || 'Failed to send request' });
        } finally {
            setAddLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto pb-12">
            {/* ... title and tabs ... */}
            {/* ... Other tabs ... */}

            {/* Tab 4: Add Friend */}
            {activeTab === 'add' && (
                <div className="bg-surface border border-border rounded-3xl p-6 sm:p-10 shadow-2xl shadow-black/20 text-center max-w-2xl mx-auto">
                    <div className="w-20 h-20 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto mb-6 shadow-inner border border-indigo-500/20">
                        <UserPlus className="w-8 h-8 text-indigo-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-primary mb-2">Send a Friend Request</h2>
                    <p className="text-secondary mb-8 max-w-md mx-auto leading-relaxed">
                        Enter your friend's email address below to send them an invite to connect on Tandem.
                    </p>

                    {addMessage && (
                        <div className={`p-4 rounded-xl mb-6 text-sm font-medium border text-left flex items-start gap-3 ${addMessage.type === 'success' ? 'bg-accent/10 border-accent/30 text-accent' : 'bg-red-500/10 border-red-500/30 text-red-400'
                            }`}>
                            {addMessage.type === 'success' ? <Check className="w-5 h-5 shrink-0" /> : <ShieldAlert className="w-5 h-5 shrink-0" />}
                            {addMessage.text}
                        </div>
                    )}

                    <div className="relative">
                        <form onSubmit={handleAddFriend} className="flex flex-col sm:flex-row gap-3">
                            <input
                                type="text"
                                value={addEmail}
                                onChange={(e) => {
                                    setAddEmail(e.target.value);
                                    if (e.target.value === '') setShowSuggestions(false);
                                }}
                                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                                placeholder="Search by name or email..."
                                required
                                className="flex-1 bg-bg border border-border rounded-xl px-5 py-3.5 text-base text-primary placeholder-secondary/50 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner"
                            />
                            <button
                                type="submit"
                                disabled={addLoading || !addEmail}
                                className="bg-gradient-to-br from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white font-bold px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                            >
                                {addLoading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" /> Send Request
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Suggestions Dropdown */}
                        {showSuggestions && suggestions.length > 0 && (
                            <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="p-2 border-b border-border bg-bg/50">
                                    <p className="text-[10px] font-bold text-secondary uppercase tracking-widest text-left px-2">People You May Know</p>
                                </div>
                                <div className="max-h-60 overflow-y-auto">
                                    {suggestions.map((user) => (
                                        <button
                                            key={user.id}
                                            type="button"
                                            onClick={() => {
                                                setAddEmail(user.email);
                                                setShowSuggestions(false);
                                            }}
                                            className="w-full p-4 flex items-center gap-4 hover:bg-white/5 transition-colors text-left group"
                                        >
                                            <Avatar name={user.name} color={user.avatar_color} size="md" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-primary truncate group-hover:text-accent transition-colors">{user.name}</p>
                                                <p className="text-xs text-secondary truncate">{user.email}</p>
                                            </div>
                                            <UserPlus className="w-4 h-4 text-secondary/30 group-hover:text-accent transition-all transform group-hover:scale-110" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {showSuggestions && addEmail.length >= 2 && suggestions.length === 0 && !addLoading && (
                            <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-surface border border-border rounded-2xl p-6 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
                                <p className="text-sm text-secondary">No users found matching "{addEmail}"</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// UI Helpers
function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer whitespace-nowrap focus:outline-none ${active
                    ? 'bg-bg text-primary shadow-inner shadow-black/50 border border-border/50'
                    : 'text-secondary/80 hover:text-primary hover:bg-white/5 border border-transparent'
                }`}
        >
            <span className={`w-4 h-4 ${active ? 'text-accent' : 'text-current opacity-70'}`}>{icon}</span>
            {label}
        </button>
    );
}

function LoadingSpinner() {
    return (
        <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
    return (
        <div className="py-24 text-center px-6">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-white/10 shadow-inner">
                <span className="w-8 h-8 text-white/30 [&>svg]:w-full [&>svg]:h-full">{icon}</span>
            </div>
            <h3 className="text-xl font-bold text-primary mb-2">{title}</h3>
            <p className="text-sm text-secondary max-w-sm mx-auto">{desc}</p>
        </div>
    );
}
