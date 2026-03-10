import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Plus,
    UserPlus,
    Receipt,
    Handshake,
    BarChart3,
    Link as LinkIcon,
    CheckCircle2,
    Trash2,
    X as XIcon,
    CreditCard,
    ArrowRight,
    Clock,
} from 'lucide-react';
import {
    groupsApi,
    expensesApi,
    balancesApi,
    settlementRecordsApi,
    Group,
    Expense,
    UserBalance,
    Settlement,
    SettlementRecord,
    requestsApi,
    PaymentRequestData
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import ExpenseCard from '../components/ExpenseCard';
import BalanceBubble from '../components/BalanceBubble';
import AddExpenseModal from '../components/AddExpenseModal';
import SettleUpModal from '../components/SettleUpModal';
import PaymentRecordCard from '../components/PaymentRecordCard';
import PaymentStatusBadge from '../components/PaymentStatusBadge';
import Avatar from '../components/Avatar';
import RequestMoneyModal from '../components/RequestMoneyModal';

type Tab = 'expenses' | 'balances' | 'settlements' | 'payments';

export default function GroupPage() {
    const { groupId } = useParams<{ groupId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [group, setGroup] = useState<Group | null>(null);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [balances, setBalances] = useState<UserBalance[]>([]);
    const [settlements, setSettlements] = useState<Settlement[]>([]);
    const [paymentRecords, setPaymentRecords] = useState<SettlementRecord[]>([]);
    const [paymentRequests, setPaymentRequests] = useState<PaymentRequestData[]>([]);
    const [activeTab, setActiveTab] = useState<Tab>('expenses');
    const [showAddExpense, setShowAddExpense] = useState(false);
    const [showInvite, setShowInvite] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteMsg, setInviteMsg] = useState('');
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(true);

    // Edit expense state
    const [expenseToEdit, setExpenseToEdit] = useState<Expense | undefined>(undefined);

    // Settle Up modal state
    const [settleUpTarget, setSettleUpTarget] = useState<Settlement | null>(null);
    const [showRequestMoney, setShowRequestMoney] = useState(false);

    useEffect(() => {
        if (groupId) loadAll();
    }, [groupId]);

    const loadAll = async () => {
        if (!groupId) return;
        setLoading(true);
        try {
            const [g, e, b, s, pr, reqs] = await Promise.all([
                groupsApi.get(groupId),
                expensesApi.list(groupId),
                balancesApi.getBalances(groupId),
                balancesApi.getSettlements(groupId),
                settlementRecordsApi.list(groupId),
                requestsApi.list(groupId)
            ]);
            setGroup(g);
            setExpenses(e);
            setBalances(b);
            setSettlements(s);
            setPaymentRecords(pr);
            setPaymentRequests(reqs.filter(r => r.status === 'pending'));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleExpenseCreatedOrUpdated = () => {
        setShowAddExpense(false);
        setExpenseToEdit(undefined);
        loadAll();
    };

    const handleEditExpense = (expense: Expense) => {
        setExpenseToEdit(expense);
        setShowAddExpense(true);
    };

    const handleDeleteExpense = async (expense: Expense) => {
        if (!groupId || !window.confirm('Are you sure you want to delete this expense?')) return;
        try {
            await expensesApi.delete(groupId, expense.id);
            await loadAll();
        } catch (err: any) {
            alert(err.message || 'Failed to delete expense');
        }
    };

    const handleDeleteGroup = async () => {
        if (!groupId || !group) return;
        if (!window.confirm(`Are you sure you want to delete "${group.name}"? This action cannot be undone and will delete all expenses.`)) return;

        try {
            await groupsApi.deleteGroup(groupId);
            navigate('/dashboard');
        } catch (err: any) {
            alert(err.message || 'Failed to delete group. You may not have permission.');
        }
    };

    const handleRemoveMember = async (userId: string, userName: string) => {
        if (!groupId) return;
        if (!window.confirm(`Are you sure you want to remove ${userName} from the group?`)) return;

        try {
            await groupsApi.removeMember(groupId, userId);
            await loadAll();
        } catch (err: any) {
            alert(err.message || 'Failed to remove member. You may not have permission, or they may be involved in active expenses.');
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!groupId || !inviteEmail.trim()) return;
        setInviteLoading(true);
        setInviteMsg('');
        try {
            const member = await groupsApi.addMember(groupId, inviteEmail.trim());
            setInviteMsg(`${member.name} has been added!`);
            setInviteEmail('');
            await loadAll();
            setTimeout(() => setInviteMsg(''), 3000);
        } catch (err: any) {
            setInviteMsg(err.message);
        } finally {
            setInviteLoading(false);
        }
    };

    const handleCopyLink = () => {
        if (!group) return;
        const url = `${window.location.origin}/invite/${group.id}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);

    const effectiveSettlements = settlements.map(s => {
        const pendingOrSentAmount = paymentRecords
            .filter(r => r.payer_id === s.from_user_id && r.payee_id === s.to_user_id && (r.status === 'pending' || r.status === 'sent'))
            .reduce((sum, r) => sum + r.amount, 0);
        return { ...s, amount: s.amount - pendingOrSentAmount };
    }).filter(s => s.amount > 0.01);

    // Find settlements where the current user owes money
    const mySettlements = effectiveSettlements.filter(s => s.from_user_id === user?.id);

    const uniquePaymentRecords = paymentRecords.filter((record, index, self) => {
        if (record.status === 'settled' || record.status === 'declined') return true;
        return index === self.findIndex((t) => (
            t.payer_id === record.payer_id &&
            t.payee_id === record.payee_id &&
            t.status === record.status &&
            t.amount === record.amount
        ));
    });

    const tabs: { key: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
        { key: 'expenses', label: 'Expenses', icon: <Receipt className="w-4 h-4" /> },
        { key: 'balances', label: 'Balances', icon: <BarChart3 className="w-4 h-4" /> },
        { key: 'settlements', label: 'Settle Up', icon: <Handshake className="w-4 h-4" />, badge: settlements.length },
        {
            key: 'payments',
            label: 'Payments',
            icon: <CreditCard className="w-4 h-4" />,
            badge: uniquePaymentRecords.filter(r => r.status !== 'settled').length
        },
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!group) {
        return (
            <div className="text-center py-20">
                <p className="text-secondary">Group not found</p>
            </div>
        );
    }



    return (
        <div className="max-w-4xl mx-auto">
            {/* Back button + header */}
            <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 text-secondary hover:text-primary text-sm mb-6 transition-colors cursor-pointer"
            >
                <ArrowLeft className="w-4 h-4" />
                Back to dashboard
            </button>

            <div className="bg-surface border border-border rounded-2xl p-6 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-5">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-2xl font-bold text-primary">{group.name}</h1>
                            <button
                                onClick={handleDeleteGroup}
                                className="p-1.5 rounded-lg text-secondary hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                                title="Delete Group"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-sm text-secondary">
                            {group.members.length} member{group.members.length !== 1 ? 's' : ''} · ${totalSpent.toFixed(2)} total
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-4 sm:mt-0">
                        <button
                            onClick={handleCopyLink}
                            className={`flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl transition-all duration-200 cursor-pointer ${copied
                                ? 'bg-accent/20 text-accent border border-accent/20'
                                : 'bg-surface-light border border-border hover:bg-border text-primary'
                                }`}
                        >
                            {copied ? <CheckCircle2 className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
                            {copied ? 'Copied!' : 'Share Link'}
                        </button>
                        <button
                            onClick={() => setShowInvite(!showInvite)}
                            className="flex items-center gap-2 bg-surface-light hover:bg-border border border-border text-sm text-primary font-medium px-4 py-2.5 rounded-xl transition-all duration-200 cursor-pointer"
                        >
                            <UserPlus className="w-4 h-4" />
                            Invite
                        </button>
                        <button
                            onClick={() => {
                                setExpenseToEdit(undefined);
                                setShowAddExpense(true);
                            }}
                            className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all duration-200 cursor-pointer"
                        >
                            <Plus className="w-4 h-4" />
                            Expense
                        </button>
                        <button
                            onClick={() => setShowRequestMoney(true)}
                            className="flex items-center gap-2 bg-indigo hover:bg-indigo-hover text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all duration-200 cursor-pointer"
                        >
                            <Handshake className="w-4 h-4" />
                            Request
                        </button>
                    </div>
                </div>

                {/* Members */}
                <div className="flex items-center gap-2">
                    <div className="flex flex-wrap gap-2">
                        {group.members.map((m) => (
                            <div key={m.user_id} className="flex items-center gap-1.5 bg-bg border border-border/50 rounded-full pl-1 pr-2 py-1">
                                <Avatar name={m.name} color={m.avatar_color} size="sm" />
                                <span className="text-xs font-medium text-secondary">{m.name.split(' ')[0]}</span>
                                <button
                                    onClick={() => handleRemoveMember(m.user_id, m.name)}
                                    className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-danger/10 text-secondary hover:text-danger transition-colors cursor-pointer ml-1"
                                    title={`Remove ${m.name}`}
                                >
                                    <XIcon className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick Settle Up Banner */}
                {mySettlements.length > 0 && (
                    <div className="mt-5 pt-5 border-t border-border">
                        <div className="bg-gradient-to-r from-accent/5 to-indigo/5 border border-accent/10 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-bold text-white/50 uppercase tracking-widest">You Owe</p>
                                <Clock className="w-3.5 h-3.5 text-white/20" />
                            </div>
                            <div className="space-y-2">
                                {mySettlements.map((s, i) => (
                                    <div key={i} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Avatar name={s.to_user_name} color={s.to_avatar_color} size="sm" />
                                            <span className="text-sm text-white/70">{s.to_user_name}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-base font-black text-white">${s.amount.toFixed(2)}</span>
                                            <button
                                                onClick={() => {
                                                    setSettleUpTarget(s);
                                                }}
                                                className="px-3 py-1.5 bg-accent/20 hover:bg-accent/30 border border-accent/20 text-accent text-xs font-bold rounded-lg transition-all cursor-pointer"
                                            >
                                                Settle Up
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Invite form */}
                {showInvite && (
                    <div className="mt-4 pt-4 border-t border-border">
                        <form onSubmit={handleInvite} className="flex items-center gap-3">
                            <input
                                type="email"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                placeholder="Enter email to invite"
                                className="flex-1 bg-bg border border-border rounded-xl px-4 py-2.5 text-sm text-primary placeholder-secondary/50 focus:outline-none focus:border-accent transition-colors"
                            />
                            <button
                                type="submit"
                                disabled={inviteLoading}
                                className="bg-accent hover:bg-accent-hover text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all duration-200 disabled:opacity-50 cursor-pointer"
                            >
                                {inviteLoading ? 'Adding...' : 'Add'}
                            </button>
                        </form>
                        {inviteMsg && (
                            <p className="text-sm text-accent mt-2">{inviteMsg}</p>
                        )}
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 bg-surface border border-border rounded-xl p-1 mb-6">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-2 flex-1 justify-center px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${activeTab === tab.key
                            ? 'bg-accent/10 text-accent'
                            : 'text-secondary hover:text-primary'
                            }`}
                    >
                        {tab.icon}
                        <span className="hidden sm:inline">{tab.label}</span>
                        {tab.badge !== undefined && tab.badge > 0 && (
                            <span className="min-w-[18px] h-[18px] bg-accent/20 text-accent text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                                {tab.badge}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            {activeTab === 'expenses' && (
                <div>
                    {expenses.length === 0 ? (
                        <div className="bg-surface border border-border rounded-2xl p-12 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-surface-light flex items-center justify-center mx-auto mb-4">
                                <Receipt className="w-7 h-7 text-secondary" />
                            </div>
                            <h3 className="text-lg font-semibold text-primary mb-2">No expenses yet</h3>
                            <p className="text-sm text-secondary mb-5">Add your first expense to get started.</p>
                            <button
                                onClick={() => setShowAddExpense(true)}
                                className="bg-accent hover:bg-accent-hover text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 cursor-pointer"
                            >
                                Add Expense
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {expenses.map((exp) => (
                                <ExpenseCard
                                    key={exp.id}
                                    expense={exp}
                                    onEdit={handleEditExpense}
                                    onDelete={handleDeleteExpense}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'balances' && (
                <div>
                    {balances.length === 0 ? (
                        <div className="bg-surface border border-border rounded-2xl p-12 text-center">
                            <p className="text-secondary">No balances to show. Add some expenses first.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {balances.map((b) => (
                                <BalanceBubble key={b.user_id} balance={b} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'settlements' && (
                <div className="space-y-6">
                    {/* Active Peer-to-Peer Requests */}
                    {paymentRequests.length > 0 && (
                        <div>
                            <h3 className="text-lg font-bold text-primary mb-3">Direct Requests</h3>
                            <div className="space-y-3">
                                {paymentRequests.map((req) => {
                                    const isPayer = req.payer_id === user?.id;
                                    return (
                                        <div key={req.id} className="bg-surface-light border border-indigo/20 rounded-2xl p-5 flex items-center justify-between shadow-lg shadow-indigo/5">
                                            <div className="flex items-center gap-3">
                                                <Avatar name={req.requester_name || 'User'} color={req.requester_avatar || '#fff'} size="md" />
                                                <div>
                                                    <p className="text-sm font-medium text-white">
                                                        <span className="font-bold">{req.requester_name}</span> requested <span className="text-indigo font-bold">${req.amount.toFixed(2)}</span>
                                                    </p>
                                                    {req.note && <p className="text-xs text-secondary mt-0.5">"{req.note}"</p>}
                                                </div>
                                            </div>
                                            {isPayer ? (
                                                <button
                                                    onClick={() => navigate('/payments')} // They will pay it from the Payments/Wallet page logic we will build next
                                                    className="px-4 py-2 bg-indigo hover:bg-indigo-hover text-white text-sm font-bold rounded-xl transition-colors cursor-pointer"
                                                >
                                                    Pay Now
                                                </button>
                                            ) : (
                                                <span className="text-xs font-bold text-secondary uppercase bg-bg px-2 py-1 rounded-md border border-border">Pending</span>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Calculated Group Debt Settlements */}
                    <div>
                        <h3 className="text-lg font-bold text-primary mb-3">Suggested Settlements</h3>
                        {effectiveSettlements.length === 0 ? (
                            <div className="bg-surface border border-border rounded-2xl p-12 text-center">
                                <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                                    <Handshake className="w-7 h-7 text-accent" />
                                </div>
                                <h3 className="text-lg font-semibold text-primary mb-2">All settled up! 🎉</h3>
                                <p className="text-sm text-secondary">No payments needed — everyone's even.</p>
                            </div>
                        ) : (
                            <div>
                                <div className="bg-surface-light border border-border rounded-xl p-4 mb-4">
                                    <p className="text-sm text-secondary">
                                        <span className="text-accent font-bold">{effectiveSettlements.length}</span> payment{effectiveSettlements.length !== 1 ? 's' : ''} needed to settle all debts
                                    </p>
                                </div>
                                <div className="space-y-3">
                                    {effectiveSettlements.map((s, i) => {
                                        const canSettle = s.from_user_id === user?.id;
                                        return (
                                            <div key={i} className="bg-[#0C0E14] border border-white/[0.06] rounded-2xl p-5 hover:border-white/10 transition-all duration-300">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <Avatar name={s.from_user_name} color={s.from_avatar_color} size="md" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 text-sm">
                                                            <span className="font-semibold text-white truncate">{s.from_user_name}</span>
                                                            <ArrowRight className="w-4 h-4 text-accent shrink-0" />
                                                            <span className="font-semibold text-white truncate">{s.to_user_name}</span>
                                                        </div>
                                                        <p className="text-xs text-white/40 mt-0.5">
                                                            owes <span className="text-accent font-bold">${s.amount.toFixed(2)}</span>
                                                        </p>
                                                    </div>
                                                    <Avatar name={s.to_user_name} color={s.to_avatar_color} size="md" />
                                                </div>

                                                {canSettle && (
                                                    <button
                                                        onClick={() => setSettleUpTarget(s)}
                                                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-accent/20 to-accent/10 hover:from-accent/30 hover:to-accent/20 border border-accent/20 hover:border-accent/40 text-accent font-bold text-sm py-3 rounded-xl transition-all duration-300 cursor-pointer shadow-lg shadow-accent/5 hover:shadow-accent/10"
                                                    >
                                                        <Handshake className="w-4 h-4" />
                                                        Settle Up ${s.amount.toFixed(2)}
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'payments' && (
                <div>
                    {paymentRecords.length === 0 ? (
                        <div className="bg-surface border border-border rounded-2xl p-12 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-indigo/10 flex items-center justify-center mx-auto mb-4">
                                <CreditCard className="w-7 h-7 text-indigo" />
                            </div>
                            <h3 className="text-lg font-semibold text-primary mb-2">No payment activity</h3>
                            <p className="text-sm text-secondary">Payment records will appear here after settling up.</p>
                        </div>
                    ) : (
                        <div>
                            {/* Status summary */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                                {(['pending', 'sent', 'settled', 'declined'] as const).map((status) => {
                                    const count = uniquePaymentRecords.filter(r => r.status === status).length;
                                    return (
                                        <div key={status} className="bg-surface border border-border rounded-xl p-3 text-center">
                                            <p className="text-lg font-black text-white mb-1">{count}</p>
                                            <PaymentStatusBadge status={status} size="sm" />
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="space-y-3">
                                {uniquePaymentRecords.map((record) => (
                                    <PaymentRecordCard
                                        key={record.id}
                                        record={record}
                                        currentUserId={user?.id || ''}
                                        groupId={groupId || ''}
                                        onUpdated={loadAll}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Add Expense Modal */}
            {showAddExpense && group && (
                <AddExpenseModal
                    groupId={group.id}
                    members={group.members}
                    expense={expenseToEdit}
                    onClose={() => {
                        setShowAddExpense(false);
                        setExpenseToEdit(undefined);
                    }}
                    onCreated={handleExpenseCreatedOrUpdated}
                    onUpdated={handleExpenseCreatedOrUpdated}
                />
            )}

            {/* Settle Up Modal */}
            {settleUpTarget && groupId && user && (
                <SettleUpModal
                    groupId={groupId}
                    settlement={settleUpTarget}
                    currentUserId={user.id}
                    onClose={() => setSettleUpTarget(null)}
                    onSettled={loadAll}
                />
            )}

            {showRequestMoney && groupId && user && group && (
                <RequestMoneyModal
                    groupId={groupId}
                    members={group.members}
                    currentUserId={user.id}
                    onClose={() => setShowRequestMoney(false)}
                    onSuccess={loadAll}
                />
            )}
        </div>
    );
}
