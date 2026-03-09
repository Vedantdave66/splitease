import { useState } from 'react';
import { X, Send, CreditCard, Building2, Wallet } from 'lucide-react';
import { requestsApi, GroupMember, PaymentRequestData } from '../services/api';
import Avatar from './Avatar';

interface RequestMoneyModalProps {
    groupId: string;
    members: GroupMember[];
    currentUserId: string;
    onClose: () => void;
    onSuccess: () => void;
}

export default function RequestMoneyModal({ groupId, members, currentUserId, onClose, onSuccess }: RequestMoneyModalProps) {
    const [amount, setAmount] = useState('');
    const [payerId, setPayerId] = useState('');
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const otherMembers = members.filter(m => m.user_id !== currentUserId);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            setError('Please enter a valid amount greater than 0');
            return;
        }

        if (!payerId) {
            setError('Please select someone to request from');
            return;
        }

        setLoading(true);
        try {
            await requestsApi.create(groupId, {
                payer_id: payerId,
                amount: numAmount,
                note: note.trim() || undefined
            });
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to send request');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-surface border border-border rounded-3xl w-full max-w-md shadow-2xl relative animate-in zoom-in-95">
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                        <Send className="w-5 h-5 text-indigo" />
                        Request Money
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-secondary hover:text-primary hover:bg-surface-hover rounded-full transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Amount Input */}
                    <div>
                        <label className="block text-sm font-semibold text-secondary mb-2">Amount</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-medium text-secondary">$</span>
                            <input
                                type="number"
                                step="0.01"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full bg-bg border border-border rounded-xl pl-9 pr-4 py-3 text-xl font-medium text-primary focus:outline-none focus:border-indigo focus:ring-1 focus:ring-indigo transition-all"
                                placeholder="0.00"
                                required
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Whom to request from */}
                    <div>
                        <label className="block text-sm font-semibold text-secondary mb-2">From</label>
                        <div className="grid gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                            {otherMembers.length === 0 ? (
                                <p className="text-sm text-secondary bg-bg p-3 rounded-xl border border-border text-center">
                                    No other members in this group.
                                </p>
                            ) : (
                                otherMembers.map((m) => (
                                    <button
                                        key={m.user_id}
                                        type="button"
                                        onClick={() => setPayerId(m.user_id)}
                                        className={`flex items-center gap-3 w-full p-3 rounded-xl border transition-all cursor-pointer ${payerId === m.user_id
                                                ? 'bg-indigo/10 border-indigo text-indigo font-bold'
                                                : 'bg-bg border-border text-primary hover:bg-surface-hover'
                                            }`}
                                    >
                                        <Avatar name={m.name} color={m.avatar_color} size="sm" />
                                        <span className="flex-1 text-left">{m.name}</span>
                                        {payerId === m.user_id && (
                                            <div className="w-3 h-3 rounded-full bg-indigo"></div>
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Note */}
                    <div>
                        <label className="block text-sm font-semibold text-secondary mb-2">What's it for? (Optional)</label>
                        <input
                            type="text"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm text-primary placeholder-secondary/50 focus:outline-none focus:border-indigo focus:ring-1 focus:ring-indigo transition-all"
                            placeholder="e.g. concert tickets, pizza..."
                            maxLength={50}
                        />
                    </div>

                    {error && <p className="text-sm text-danger text-center font-medium">{error}</p>}

                    <button
                        type="submit"
                        disabled={loading || !amount || !payerId}
                        className="w-full py-3.5 rounded-xl font-bold text-white bg-indigo hover:bg-indigo-hover transition-colors shadow-lg shadow-indigo/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        {loading ? 'Sending Request...' : 'Send Request'}
                    </button>

                    <p className="text-xs text-center text-secondary/60 mt-4 flex items-center justify-center gap-1.5">
                        <Wallet className="w-3.5 h-3.5" /> Direct payments settle instantly from the ledger
                    </p>
                </form>
            </div>
        </div>
    );
}
