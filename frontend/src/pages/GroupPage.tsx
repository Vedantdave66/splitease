import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Plus,
    UserPlus,
    Receipt,
    Handshake,
    BarChart3,
} from 'lucide-react';
import {
    groupsApi,
    expensesApi,
    balancesApi,
    Group,
    Expense,
    UserBalance,
    Settlement,
} from '../services/api';
import ExpenseCard from '../components/ExpenseCard';
import BalanceBubble from '../components/BalanceBubble';
import SettlementCard from '../components/SettlementCard';
import AddExpenseModal from '../components/AddExpenseModal';
import Avatar from '../components/Avatar';

type Tab = 'expenses' | 'balances' | 'settlements';

export default function GroupPage() {
    const { groupId } = useParams<{ groupId: string }>();
    const navigate = useNavigate();

    const [group, setGroup] = useState<Group | null>(null);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [balances, setBalances] = useState<UserBalance[]>([]);
    const [settlements, setSettlements] = useState<Settlement[]>([]);
    const [activeTab, setActiveTab] = useState<Tab>('expenses');
    const [showAddExpense, setShowAddExpense] = useState(false);
    const [showInvite, setShowInvite] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteMsg, setInviteMsg] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (groupId) loadAll();
    }, [groupId]);

    const loadAll = async () => {
        if (!groupId) return;
        setLoading(true);
        try {
            const [g, e, b, s] = await Promise.all([
                groupsApi.get(groupId),
                expensesApi.list(groupId),
                balancesApi.getBalances(groupId),
                balancesApi.getSettlements(groupId),
            ]);
            setGroup(g);
            setExpenses(e);
            setBalances(b);
            setSettlements(s);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleExpenseCreated = () => {
        setShowAddExpense(false);
        loadAll();
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

    const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
        { key: 'expenses', label: 'Expenses', icon: <Receipt className="w-4 h-4" /> },
        { key: 'balances', label: 'Balances', icon: <BarChart3 className="w-4 h-4" /> },
        { key: 'settlements', label: 'Settle Up', icon: <Handshake className="w-4 h-4" /> },
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

    const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);

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
                <div className="flex items-start justify-between mb-5">
                    <div>
                        <h1 className="text-2xl font-bold text-primary mb-1">{group.name}</h1>
                        <p className="text-sm text-secondary">
                            {group.members.length} member{group.members.length !== 1 ? 's' : ''} · ${totalSpent.toFixed(2)} total
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowInvite(!showInvite)}
                            className="flex items-center gap-2 bg-surface-light hover:bg-border text-sm text-primary font-medium px-4 py-2.5 rounded-xl transition-all duration-200 cursor-pointer"
                        >
                            <UserPlus className="w-4 h-4" />
                            Invite
                        </button>
                        <button
                            onClick={() => setShowAddExpense(true)}
                            className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all duration-200 cursor-pointer"
                        >
                            <Plus className="w-4 h-4" />
                            Add Expense
                        </button>
                    </div>
                </div>

                {/* Members */}
                <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                        {group.members.map((m) => (
                            <Avatar key={m.user_id} name={m.name} color={m.avatar_color} size="sm" />
                        ))}
                    </div>
                    <span className="text-xs text-secondary ml-2">
                        {group.members.map((m) => m.name.split(' ')[0]).join(', ')}
                    </span>
                </div>

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
                        {tab.label}
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
                                <ExpenseCard key={exp.id} expense={exp} />
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
                <div>
                    {settlements.length === 0 ? (
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
                                    <span className="text-accent font-bold">{settlements.length}</span> payment{settlements.length !== 1 ? 's' : ''} needed to settle all debts
                                </p>
                            </div>
                            <div className="space-y-3">
                                {settlements.map((s, i) => (
                                    <SettlementCard key={i} settlement={s} />
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
                    onClose={() => setShowAddExpense(false)}
                    onCreated={handleExpenseCreated}
                />
            )}
        </div>
    );
}
