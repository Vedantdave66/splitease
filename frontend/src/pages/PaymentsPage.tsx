import { useState, useEffect } from 'react';
import { CreditCard, History, Wallet, ArrowRightLeft, ArrowDownRight, ArrowUpRight, CheckCircle2, AlertCircle, Building2, Plus, LogOut, CheckCircle, ExternalLink } from 'lucide-react';
import { meApi, SettlementRecord, settlementRecordsApi, walletApi, bankLinksApi, stripeApi, WalletTransaction, ProviderAccount } from '../services/api';
import PaymentRecordCard from '../components/PaymentRecordCard';
import AddFundsModal from '../components/AddFundsModal';
import LinkBankModal from '../components/LinkBankModal';
import { useAuth } from '../context/AuthContext';

export default function PaymentsPage() {
    const { user, refetchUser } = useAuth();
    const [payments, setPayments] = useState<SettlementRecord[]>([]);
    const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
    const [bankAccounts, setBankAccounts] = useState<ProviderAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddFundsOpen, setIsAddFundsOpen] = useState(false);
    const [isLinkBankOpen, setIsLinkBankOpen] = useState(false);
    const [withdrawLoading, setWithdrawLoading] = useState(false);
    const [stripeOnboarded, setStripeOnboarded] = useState(false);
    const [stripeLoading, setStripeLoading] = useState(false);

    useEffect(() => {
        loadAll();
    }, []);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [payData, transData, bankData, stripeData] = await Promise.all([
                meApi.getPayments(),
                walletApi.getTransactions(),
                bankLinksApi.list(),
                stripeApi.getStatus()
            ]);
            setPayments(payData);
            setTransactions(transData);
            setBankAccounts(bankData);
            setStripeOnboarded(stripeData.onboarded);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleWithdraw = async () => {
        if (!user || user.wallet_balance <= 0) return;
        if (bankAccounts.length === 0) {
            alert("Please link a bank account to withdraw funds.");
            return;
        }

        const account = bankAccounts[0]; // For MVP, withdraw to the first linked account
        if (window.confirm(`Withdraw $${user.wallet_balance.toFixed(2)} to ${account.provider} (${account.account_mask})?`)) {
            setWithdrawLoading(true);
            try {
                await walletApi.withdraw({
                    destination_account: account.id
                });
                await refetchUser();
                await loadAll();
            } catch (err: any) {
                alert(err.message || 'Failed to withdraw');
            } finally {
                setWithdrawLoading(false);
            }
        }
    };

    const handleStripeOnboard = async () => {
        setStripeLoading(true);
        try {
            const res = await stripeApi.onboard();
            window.location.href = res.url;
        } catch (err: any) {
            alert(err.message || 'Failed to initiate Stripe onboarding');
        } finally {
            setStripeLoading(false);
        }
    };

    const pendingConfirmation = payments.filter(
        (p) => p.payee_id === user?.id && p.status === 'sent'
    );
    const needToSend = payments.filter(
        (p) => p.payer_id === user?.id && p.status === 'pending'
    );
    const history = payments.filter(
        (p) => p.status === 'settled' || p.status === 'declined'
    );

    return (
        <div className="max-w-4xl mx-auto pb-12">
            <div className="mb-8">
                <h1 className="text-3xl font-black text-primary mb-2">Payments & Wallet</h1>
                <p className="text-secondary">Manage your linked accounts and payment history across all groups.</p>
            </div>

            {/* Wallet Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-gradient-to-br from-indigo/20 to-surface-light border border-indigo/20 rounded-3xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo/10 blur-2xl rounded-full translate-x-1/2 -translate-y-1/2" />
                    <div className="flex items-center gap-3 mb-6 relative z-10">
                        <div className="w-10 h-10 bg-indigo/20 rounded-xl flex items-center justify-center border border-indigo/30">
                            <Wallet className="w-5 h-5 text-indigo" />
                        </div>
                        <h3 className="text-lg font-bold text-primary">SplitEase Balance</h3>
                    </div>
                    <div className="relative z-10">
                        <p className="text-sm font-medium text-secondary mb-1">Available Funds</p>
                        <p className="text-4xl font-black text-primary tracking-tight mb-6">${(user?.wallet_balance || 0).toFixed(2)}</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsAddFundsOpen(true)}
                                className="flex-1 bg-surface-light border-border text-primary hover:bg-border font-semibold py-2.5 rounded-xl transition-colors text-sm border cursor-pointer"
                            >
                                Add Funds
                            </button>
                            <button
                                onClick={handleWithdraw}
                                disabled={withdrawLoading || !user || user.wallet_balance <= 0}
                                className="flex-1 bg-indigo hover:bg-indigo-hover text-white font-semibold py-2.5 rounded-xl transition-colors text-sm shadow-lg shadow-indigo/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {withdrawLoading ? 'Processing...' : 'Withdraw'}
                            </button>
                        </div>
                        <p className="text-xs text-secondary mt-3 text-center">Powered by SplitEase Ledger</p>
                    </div>
                </div>

                {bankAccounts.length === 0 ? (
                    <div className="bg-surface-light border border-border rounded-3xl p-6 flex flex-col justify-center items-center text-center">
                        <div className="w-16 h-16 bg-bg border border-border/50 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
                            <Building2 className="w-8 h-8 text-secondary" />
                        </div>
                        <h3 className="text-lg font-bold text-primary mb-2">Linked Accounts</h3>
                        <p className="text-sm text-secondary mb-6 max-w-[250px]">
                            Connect your bank to add funds or withdraw your balance securely.
                        </p>
                        <button
                            onClick={() => setIsLinkBankOpen(true)}
                            className="px-6 py-2.5 bg-indigo hover:bg-indigo-hover rounded-xl text-sm font-semibold text-white transition-all shadow-md shadow-indigo/20 flex items-center gap-2 cursor-pointer"
                        >
                            <Building2 className="w-4 h-4" /> Link Bank Account
                        </button>
                    </div>
                ) : (
                    <div className="bg-surface-light border border-border rounded-3xl p-6 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                                    <Building2 className="w-5 h-5 text-indigo" />
                                    Linked Accounts
                                </h3>
                                <button
                                    onClick={() => setIsLinkBankOpen(true)}
                                    className="p-1.5 rounded-lg text-secondary hover:text-indigo hover:bg-indigo/10 transition-colors cursor-pointer"
                                >
                                    <Plus className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-3">
                                {bankAccounts.map(account => (
                                    <div key={account.id} className="flex items-center justify-between p-4 rounded-xl bg-bg border border-border">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center border border-border/50">
                                                <Building2 className="w-5 h-5 text-secondary" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-primary">{account.provider}</p>
                                                <p className="text-xs text-secondary tracking-widest">{account.account_mask}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={async () => {
                                                if (window.confirm(`Unlink ${account.provider}?`)) {
                                                    try {
                                                        await bankLinksApi.remove(account.id);
                                                        await loadAll();
                                                    } catch (err: any) { alert(err.message); }
                                                }
                                            }}
                                            className="p-2 rounded-lg text-red-500/50 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                                            title="Unlink Account"
                                        >
                                            <LogOut className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Stripe Connect Section */}
                <div className="bg-surface border border-border rounded-3xl p-6 flex flex-col justify-between">
                    <div>
                        <div className="w-10 h-10 bg-[#635BFF]/10 rounded-xl flex items-center justify-center border border-[#635BFF]/30 mb-4">
                            <CreditCard className="w-5 h-5 text-[#635BFF]" />
                        </div>
                        <h3 className="text-lg font-bold text-primary mb-2">Receive Payments</h3>
                        <p className="text-sm text-secondary mb-6">
                            Connect your bank with Stripe to receive instant payouts from friends.
                        </p>
                    </div>
                    {stripeOnboarded ? (
                        <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                            <CheckCircle className="w-5 h-5 text-emerald-500" />
                            <p className="text-sm font-bold text-emerald-500">Stripe Connected</p>
                        </div>
                    ) : (
                        <button
                            onClick={handleStripeOnboard}
                            disabled={stripeLoading}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-[#635BFF] hover:bg-[#524BFF] text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-[#635BFF]/20 cursor-pointer disabled:opacity-50"
                        >
                            {stripeLoading ? 'Connecting...' : 'Connect Stripe'} 
                            {!stripeLoading && <ExternalLink className="w-4 h-4" />}
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Action Required */}
                    {(pendingConfirmation.length > 0 || needToSend.length > 0) && (
                        <div>
                            <h2 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
                                <AlertCircle className="w-5 h-5 text-warning" />
                                Action Required
                            </h2>
                            <div className="space-y-3">
                                {pendingConfirmation.map((p) => (
                                    <PaymentRecordCard
                                        key={p.id}
                                        record={p}
                                        currentUserId={user?.id || ''}
                                        groupId={p.group_id}
                                        onUpdated={loadAll}
                                    />
                                ))}
                                {needToSend.map((p) => (
                                    <PaymentRecordCard
                                        key={p.id}
                                        record={p}
                                        currentUserId={user?.id || ''}
                                        groupId={p.group_id}
                                        onUpdated={loadAll}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Transaction History (Ledger) */}
                    <div>
                        <h2 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
                            <History className="w-5 h-5 text-secondary" />
                            Ledger History
                        </h2>
                        {transactions.length === 0 ? (
                            <div className="bg-surface border border-border rounded-2xl p-10 text-center">
                                <History className="w-10 h-10 text-border mx-auto mb-3" />
                                <p className="text-secondary text-sm">No transactions yet.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {transactions.map((t) => (
                                    <div key={t.id} className="flex items-center justify-between p-4 bg-surface border border-border rounded-2xl flex-wrap gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 shrink-0
                                                ${t.tx_type === 'deposit' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                                                    t.tx_type === 'withdrawal' ? 'bg-indigo/10 border-indigo/20 text-indigo' :
                                                        'bg-accent/10 border-accent/20 text-accent'}
                                            `}>
                                                {t.tx_type === 'deposit' ? <ArrowDownRight className="w-5 h-5" /> :
                                                    t.tx_type === 'withdrawal' ? <ArrowUpRight className="w-5 h-5" /> :
                                                        <ArrowRightLeft className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <p className="font-bold text-primary capitalize">{t.tx_type}</p>
                                                <p className="text-xs text-secondary mt-0.5">
                                                    {new Date(t.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    {t.related_request_id && " • Payment Request"}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`font-black text-lg ${t.tx_type === 'deposit' || t.tx_type === 'transfer_in' ? 'text-emerald-500' : 'text-primary'}`}>
                                                {t.tx_type === 'deposit' || t.tx_type === 'transfer_in' ? '+' : '-'}${t.amount.toFixed(2)}
                                            </p>
                                            <span className={`text-[10px] font-bold uppercase tracking-widest mt-1 block
                                                ${t.status === 'completed' || t.status === 'settled' ? 'text-emerald-500/80' :
                                                    t.status === 'pending' ? 'text-warning/80' : 'text-danger/80'}
                                            `}>
                                                {t.status}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <AddFundsModal
                isOpen={isAddFundsOpen}
                onClose={() => setIsAddFundsOpen(false)}
                onSuccess={() => {
                    refetchUser();
                    loadAll();
                }}
            />

            <LinkBankModal
                isOpen={isLinkBankOpen}
                onClose={() => setIsLinkBankOpen(false)}
                onSuccess={() => {
                    refetchUser();
                    loadAll();
                }}
            />
        </div>
    );
}
