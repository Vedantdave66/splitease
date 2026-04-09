import { useEffect, useState } from 'react';
import { formatCurrency } from '../utils/currency';
import { X, Send, Building2, CreditCard, Copy, CheckCircle2, ArrowRight, Loader2, Landmark } from 'lucide-react';
import { Settlement, settlementRecordsApi, walletApi, stripeApi } from '../services/api';
import Avatar from './Avatar';
import StripePaymentModal from './StripePaymentModal';

interface SettleUpModalProps {
    groupId: string;
    settlement: Settlement;
    currentUserId: string;
    onClose: () => void;
    onSettled: () => void;
}

type Step = 'method' | 'etransfer' | 'select_bank' | 'in_app_confirm' | 'in_app_processing' | 'in_app_success' | 'sent_confirmation';

export default function SettleUpModal({ groupId, settlement, currentUserId, onClose, onSettled }: SettleUpModalProps) {
    const [step, setStep] = useState<Step>('method');
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState('');
    const [walletBalance, setWalletBalance] = useState<number | null>(null);
    const [showStripeModal, setShowStripeModal] = useState(false);
    const [activeRecordId, setActiveRecordId] = useState<string | undefined>(undefined);

    const isPayer = settlement.from_user_id === currentUserId;
    const recipientName = isPayer ? settlement.to_user_name : settlement.from_user_name;
    const recipientEmail = isPayer ? settlement.to_user_email : settlement.from_user_email;
    const recipientColor = isPayer ? settlement.to_avatar_color : settlement.from_avatar_color;

    useEffect(() => {
        if (isPayer) {
            walletApi.getBalance().then(u => setWalletBalance(u.wallet_balance)).catch(console.error);
        }
    }, [isPayer]);



    const handleCopyEmail = () => {
        navigator.clipboard.writeText(recipientEmail);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleInitiateSettlement = async (method: string) => {
        setLoading(true);
        setError('');
        try {
            if (method === 'etransfer') {
                await settlementRecordsApi.create(groupId, {
                    payee_id: settlement.to_user_id,
                    amount: settlement.amount,
                    method,
                });
                setStep('etransfer');
            } else if (method === 'stripe') {
                // Instantly create a paper trail and open Stripe
                const record = await settlementRecordsApi.create(groupId, {
                    payee_id: settlement.to_user_id,
                    amount: settlement.amount,
                    method: 'stripe'
                });
                setActiveRecordId(record.id);
                setShowStripeModal(true);
            }
        } catch (err: any) {
            let msg = err.message || 'Failed to initiate settlement';
            if (msg.includes('Recipient must connect')) {
                msg = "This user hasn't set up payouts yet.";
            }
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleMarkSent = async () => {
        setLoading(true);
        try {
            const records = await settlementRecordsApi.list(groupId);
            const latest = records.find(r =>
                r.payer_id === settlement.from_user_id &&
                r.payee_id === settlement.to_user_id &&
                r.status === 'pending'
            );
            if (latest) {
                await settlementRecordsApi.updateStatus(groupId, latest.id, 'sent');
            }
            setStep('sent_confirmation');
        } catch (err: any) {
            setError(err.message || 'Failed to mark as sent');
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

            <div className="relative bg-surface border border-border rounded-3xl w-full max-w-md mx-4 shadow-[0_25px_60px_rgba(0,0,0,0.6)] overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-40 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

                <div className="relative flex items-center justify-between p-6 pb-4">
                    <h2 className="text-lg font-bold text-primary">
                        {step === 'method' && 'Pay Balance'}
                        {step === 'etransfer' && 'E-Transfer'}
                        {step === 'sent_confirmation' && 'Payment Marked'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer"
                        aria-label="Close"
                    >
                        <X className="w-4 h-4 text-white/60" />
                    </button>
                </div>

                <div className="relative px-6 pb-6">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl p-3 mb-4">
                            {error}
                        </div>
                    )}

                    {/* METHOD SELECTION */}
                    {step === 'method' && (
                        <div className="space-y-5">
                            <div className="text-center py-4">
                                <div className="flex items-center justify-center gap-3 mb-4">
                                    <Avatar name={settlement.from_user_name} color={settlement.from_avatar_color} size="md" />
                                    <ArrowRight className="w-5 h-5 text-accent" />
                                    <Avatar name={settlement.to_user_name} color={settlement.to_avatar_color} size="md" />
                                </div>
                                <p className="text-sm text-secondary mb-1">Amount to settle</p>
                                <p className="text-4xl font-black text-primary tracking-tight">
                                    ${formatCurrency(settlement?.amount)}
                                </p>
                                <p className="text-sm text-secondary mt-2">
                                    {settlement.from_user_name} → {settlement.to_user_name}
                                </p>
                            </div>

                            <div className="space-y-3">
                                <button
                                    onClick={() => handleInitiateSettlement('stripe')}
                                    disabled={loading}
                                    className="w-full flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-accent/10 to-accent/5 border border-accent/20 hover:border-accent/40 transition-all duration-300 cursor-pointer group disabled:opacity-50"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center group-hover:bg-accent/30 transition-colors">
                                        <CreditCard className="w-6 h-6 text-accent" />
                                    </div>
                                    <div className="text-left flex-1">
                                        <p className="text-sm font-bold text-primary mb-0.5">Pay with Card / Apple Pay</p>
                                        <p className="text-xs text-accent">Secure payment via Stripe</p>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-accent/40 group-hover:text-accent transition-colors" />
                                </button>

                                <button
                                    onClick={() => handleInitiateSettlement('etransfer')}
                                    disabled={loading}
                                    className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-indigo/30 transition-all duration-300 cursor-pointer group disabled:opacity-50"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-indigo/10 flex items-center justify-center group-hover:bg-indigo/20 transition-colors">
                                        <Landmark className="w-6 h-6 text-indigo" />
                                    </div>
                                    <div className="text-left flex-1">
                                        <p className="text-sm font-bold text-primary">E-Transfer</p>
                                        <p className="text-xs text-secondary">Send manually outside the app</p>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-indigo transition-colors" />
                                </button>
                            </div>
                        </div>
                    )}



                    {/* E-TRANSFER */}
                    {step === 'etransfer' && (
                        <div className="space-y-5">
                            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
                                <div className="flex items-center gap-4 mb-5">
                                    <Avatar name={recipientName} color={recipientColor} size="md" />
                                    <div>
                                        <p className="text-sm font-bold text-white">{recipientName}</p>
                                        <p className="text-xs text-white/40">Recipient</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between bg-bg rounded-xl px-4 py-3 border border-border">
                                        <div>
                                            <p className="text-[10px] text-secondary uppercase tracking-widest mb-0.5">Email</p>
                                            <p className="text-sm font-bold text-primary">{recipientEmail}</p>
                                        </div>
                                        <button
                                            onClick={handleCopyEmail}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
                                        >
                                            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-accent" /> : <Copy className="w-3.5 h-3.5 text-white/50" />}
                                            <span className="text-xs text-white/60">{copied ? 'Copied' : 'Copy'}</span>
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between bg-bg rounded-xl px-4 py-3 border border-border">
                                        <div>
                                            <p className="text-[10px] text-secondary uppercase tracking-widest mb-0.5">Amount</p>
                                            <p className="text-lg font-black text-accent">${formatCurrency(settlement?.amount)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleMarkSent}
                                disabled={loading}
                                className="w-full bg-gradient-to-r from-accent to-emerald-500 hover:from-accent-hover hover:to-emerald-600 text-[#064E3B] font-bold py-3.5 rounded-xl transition-all duration-300 disabled:opacity-50 cursor-pointer shadow-lg shadow-accent/20"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "I've Sent the Money"}
                            </button>
                        </div>
                    )}

                    {/* SENT CONFIRMATION (E-Transfer) */}
                    {step === 'sent_confirmation' && (
                        <div className="py-8 text-center space-y-5">
                            <div className="w-20 h-20 rounded-full bg-indigo/10 border-2 border-indigo/30 flex items-center justify-center mx-auto">
                                <Send className="w-9 h-9 text-indigo" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white mb-1">Payment Marked as Sent</h3>
                                <p className="text-sm text-white/40">
                                    {recipientName} will be notified to confirm when they receive it.
                                </p>
                            </div>
                            <button
                                onClick={() => { onSettled(); onClose(); }}
                                className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-white font-semibold py-3 rounded-xl transition-all duration-200 cursor-pointer"
                            >
                                Done
                            </button>
                        </div>
                    )}
                </div>
            </div>
            
            {showStripeModal && activeRecordId && (
                <StripePaymentModal 
                    payeeId={settlement.to_user_id}
                    amount={settlement.amount}
                    settlementId={activeRecordId}
                    onClose={() => setShowStripeModal(false)}
                    onSuccess={() => { 
                        setShowStripeModal(false); 
                        onSettled(); 
                        onClose(); 
                    }}
                />
            )}
        </div>
    );
}
