import { useState, useEffect } from 'react';
import { Plus, TrendingUp, Receipt, Users } from 'lucide-react';
import { groupsApi, GroupListItem } from '../services/api';
import GroupCard from '../components/GroupCard';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
    const { user } = useAuth();
    const [groups, setGroups] = useState<GroupListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        loadGroups();
    }, []);

    const loadGroups = async () => {
        try {
            const data = await groupsApi.list();
            setGroups(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newGroupName.trim()) return;
        setCreating(true);
        try {
            await groupsApi.create(newGroupName.trim());
            setNewGroupName('');
            setShowCreate(false);
            await loadGroups();
        } catch (err) {
            console.error(err);
        } finally {
            setCreating(false);
        }
    };

    const totalSpending = groups.reduce((sum, g) => sum + g.total_expenses, 0);
    const totalGroups = groups.length;

    return (
        <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-primary mb-1">
                    Welcome back, {user?.name?.split(' ')[0]} 👋
                </h1>
                <p className="text-secondary text-sm">Here's an overview of your shared expenses</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="bg-surface border border-border rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-accent" />
                        </div>
                        <span className="text-xs font-medium text-secondary uppercase tracking-wider">Total Spending</span>
                    </div>
                    <p className="text-2xl font-bold text-primary">
                        ${totalSpending.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                </div>

                <div className="bg-surface border border-border rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-[#6366F1]/10 flex items-center justify-center">
                            <Users className="w-5 h-5 text-[#6366F1]" />
                        </div>
                        <span className="text-xs font-medium text-secondary uppercase tracking-wider">Groups</span>
                    </div>
                    <p className="text-2xl font-bold text-primary">{totalGroups}</p>
                </div>

                <div className="bg-surface border border-border rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 flex items-center justify-center">
                            <Receipt className="w-5 h-5 text-[#F59E0B]" />
                        </div>
                        <span className="text-xs font-medium text-secondary uppercase tracking-wider">Avg per Group</span>
                    </div>
                    <p className="text-2xl font-bold text-primary">
                        ${totalGroups > 0
                            ? (totalSpending / totalGroups).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            : '0.00'}
                    </p>
                </div>
            </div>

            {/* Groups header */}
            <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-primary">Your Groups</h2>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all duration-200 cursor-pointer"
                >
                    <Plus className="w-4 h-4" />
                    New Group
                </button>
            </div>

            {/* Create group form */}
            {showCreate && (
                <div className="bg-surface border border-accent/30 rounded-2xl p-5 mb-5">
                    <form onSubmit={handleCreate} className="flex items-center gap-3">
                        <input
                            type="text"
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            placeholder="Group name (e.g. NYC Trip, Apartment)"
                            autoFocus
                            className="flex-1 bg-bg border border-border rounded-xl px-4 py-3 text-sm text-primary placeholder-secondary/50 focus:outline-none focus:border-accent transition-colors"
                        />
                        <button
                            type="submit"
                            disabled={creating}
                            className="bg-accent hover:bg-accent-hover text-white text-sm font-semibold px-5 py-3 rounded-xl transition-all duration-200 disabled:opacity-50 cursor-pointer"
                        >
                            {creating ? 'Creating...' : 'Create'}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setShowCreate(false); setNewGroupName(''); }}
                            className="text-secondary hover:text-primary text-sm px-3 py-3 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                    </form>
                </div>
            )}

            {/* Groups grid */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                </div>
            ) : groups.length === 0 ? (
                <div className="bg-surface border border-border rounded-2xl p-12 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-surface-light flex items-center justify-center mx-auto mb-4">
                        <Users className="w-8 h-8 text-secondary" />
                    </div>
                    <h3 className="text-lg font-semibold text-primary mb-2">No groups yet</h3>
                    <p className="text-sm text-secondary mb-5">Create a group to start tracking shared expenses.</p>
                    <button
                        onClick={() => setShowCreate(true)}
                        className="bg-accent hover:bg-accent-hover text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 cursor-pointer"
                    >
                        Create your first group
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groups.map((group) => (
                        <GroupCard key={group.id} group={group} />
                    ))}
                </div>
            )}
        </div>
    );
}
