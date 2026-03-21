import { useEffect, useState } from 'react';
import { X, Send, Building2, CreditCard, Copy, CheckCircle2, ArrowRight, Loader2, Shield, Landmark, Wallet, Plus } from 'lucide-react';
import { Settlement, settlementRecordsApi, walletApi, bankLinksApi, stripeApi, ProviderAccount } from '../services/api';
import Avatar from './Avatar';
import LinkBankModal from './LinkBankModal';

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
    const [linkedBanks, setLinkedBanks] = useState<ProviderAccount[]>([]);
    const [selectedBank, setSelectedBank] = useState<ProviderAccount | null>(null);
    const [showLinkModal, setShowLinkModal] = useState(false);

    const isPayer = settlement.from_user_id === currentUserId;
    const recipientName = isPayer ? settlement.to_user_name : settlement.from_user_name;
    const recipientEmail = isPayer ? settlement.to_user_email : settlement.from_user_email;
    const recipientColor = isPayer ? settlement.to_avatar_color : settlement.from_avatar_color;

    useEffect(() => {
        if (isPayer) {
            walletApi.getBalance().then(u => setWalletBalance(u.wallet_balance)).catch(console.error);
        }
    }, [isPayer]);

    const loadBanks = async () => {
        try {
            const banks = await bankLinksApi.list();
            setLinkedBanks(banks);
        } catch (err) {
            console.error("Failed to load banks");
        }
    };

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
            } else {
                await loadBanks();
                setStep('select_bank');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to initiate settlement');
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

    const handleInAppConfirm = async () => {
        if (!selectedBank) return;
        setStep('in_app_processing');
        setError('');
        try {
            // First create a record so we have a paper trail
            const record = await settlementRecordsApi.create(groupId, {
                payee_id: settlement.to_user_id,
                amount: settlement.amount,
                method: 'in_app'
            });

            // Call Stripe to execute the ACH transfer
            await stripeApi.createPaymentIntent({
                amount: settlement.amount,
                payee_id: settlement.to_user_id,
                provider_account_id: selectedBank.id
            });

            // If Stripe succeeds, mark it settled/processing
            await settlementRecordsApi.updateStatus(groupId, record.id, 'settled');
            
            setStep('in_app_success');
        } catch (err: any) {
            setError(err.message || "Failed to process Stripe transfer");
            setStep('in_app_confirm');
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
                        {step === 'select_bank' && 'Select Payment Method'}
                        {step === 'in_app_confirm' && 'Confirm Payment'}
                        {step === 'in_app_processing' && 'Processing'}
                        {step === 'in_app_success' && 'Payment Sent'}
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
                                    ${settlement.amount.toFixed(2)}
                                </p>
                                <p className="text-sm text-secondary mt-2">
                                    {settlement.from_user_name} → {settlement.to_user_name}
                                </p>
                            </div>

                            <div className="space-y-3">
                                <button
                                    onClick={() => handleInitiateSettlement('in_app')}
                                    disabled={loading}
                                    className="w-full flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-accent/10 to-accent/5 border border-accent/20 hover:border-accent/40 transition-all duration-300 cursor-pointer group disabled:opacity-50"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center group-hover:bg-accent/30 transition-colors">
                                        <Wallet className="w-6 h-6 text-accent" />
                                    </div>
                                    <div className="text-left flex-1">
                                        <p className="text-sm font-bold text-primary mb-0.5">Pay in App</p>
                                        <p className="text-xs text-accent">Powered by Stripe & Plaid</p>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-accent/40 group-hover:text-accent transition-colors" />
                                </button>

                                <button
                                    onClick={() => handleInitiateSettlement('etransfer')}
                                    disabled={loading}
                                    className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-indigo/30 transition-all duration-300 cursor-pointer group disabled:opacity-50"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-indigo/10 flex items-center justify-center group-hover:bg-indigo/20 transition-colors">
                                        <Building2 className="w-6 h-6 text-indigo" />
                                    </div>
                                    <div className="text-left flex-1">
                                        <p className="text-sm font-bold text-primary">E-Transfer</p>
                                        <p className="text-xs text-secondary">Send manually via bank</p>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-indigo transition-colors" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* SELECT BANK (Plaid) */}
                    {step === 'select_bank' && (
                        <div className="space-y-5">
                            <div className="text-center py-3">
                                <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4 border border-accent/20">
                                    <Landmark className="w-8 h-8 text-accent" />
                                </div>
                                <h3 className="text-base font-bold text-white mb-1">Choose Payment Source</h3>
                                <p className="text-xs text-white/40">Select a securely linked bank account</p>
                            </div>

                            {linkedBanks.map((bank) => (
                                <button
                                    key={bank.id}
                                    onClick={() => { setSelectedBank(bank); setStep('in_app_confirm'); }}
                                    className="w-full flex items-center gap-4 p-3.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-accent/30 transition-all duration-200 cursor-pointer group"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                                        <Building2 className="w-5 h-5 text-white/40 group-hover:text-accent transition-colors" />
                                    </div>
                                    <div className="text-left flex-1">
                                        <span className="text-sm font-medium text-white/80 block">{bank.institution_name}</span>
                                        <span className="text-xs text-white/40 block">•••• {bank.account_mask}</span>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-accent transition-colors" />
                                </button>
                            ))}
                            
                            {linkedBanks.length === 0 && (
                                <div className="text-center py-4 bg-white/5 rounded-xl border border-white/10">
                                    <p className="text-sm text-secondary mb-3">No bank accounts linked yet.</p>
                                </div>
                            )}

                            <button 
                                onClick={() => setShowLinkModal(true)}
                                className="w-full py-3 flex items-center justify-center gap-2 border border-dashed border-white/20 rounded-xl text-secondary hover:text-white hover:border-white/40 transition-colors cursor-pointer"
                            >
                                <Plus className="w-4 h-4" /> Link a new Bank
                            </button>

                            <div className="flex items-center gap-2 justify-center pt-2">
                                <Shield className="w-3.5 h-3.5 text-accent/40" />
                                <p className="text-[10px] text-white/30 uppercase tracking-widest">256-bit Encrypted via Stripe</p>
                            </div>
                        </div>
                    )}

                    {/* CONFIRM PAYMENT */}
                    {step === 'in_app_confirm' && selectedBank && (
                        <div className="space-y-5">
                            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-4">
                                <div className="text-center">
                                    <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Sending to</p>
                                    <div className="flex items-center justify-center gap-3">
                                        <Avatar name={recipientName} color={recipientColor} size="md" />
                                        <p className="text-base font-bold text-white">{recipientName}</p>
                                    </div>
                                </div>

                                <div className="border-t border-white/5 pt-4 text-center">
                                    <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Amount</p>
                                    <p className="text-3xl font-black text-white">${settlement.amount.toFixed(2)}</p>
                                </div>

                                <div className="border-t border-white/5 pt-4 space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-white/40">Funding Source</span>
                                        <span className="text-white/70">{selectedBank.institution_name} •••• {selectedBank.account_mask}</span>
                                    </div>
                                    <div className="flex justify-between text-xs mt-2 pt-2 border-t border-white/5">
                                        <span className="text-white/40">Fee</span>
                                        <span className="text-accent font-medium">Free</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-white/40">Arrives</span>
                                        <span className="text-white/70">Instantly via Stripe ACH</span>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleInAppConfirm}
                                className="w-full bg-gradient-to-r from-accent to-emerald-500 text-[#064E3B] font-bold py-3.5 rounded-xl transition-all duration-300 cursor-pointer shadow-lg shadow-accent/20 hover:shadow-accent/30 hover:from-accent-hover hover:to-emerald-600"
                            >
                                Confirm & Send ${settlement.amount.toFixed(2)}
                            </button>
                        </div>
                    )}

                    {/* PROCESSING */}
                    {step === 'in_app_processing' && (
                        <div className="py-12 text-center space-y-6">
                            <div className="relative mx-auto w-20 h-20">
                                <div className="absolute inset-0 rounded-full border-2 border-accent/20" />
                                <div className="absolute inset-0 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                                <div className="absolute inset-3 rounded-full bg-accent/10 flex items-center justify-center">
                                    <CreditCard className="w-7 h-7 text-accent" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white mb-1">Processing Payment</h3>
                                <p className="text-sm text-white/40">Communicating with Stripe...</p>
                            </div>
                            <div className="flex items-center gap-2 justify-center">
                                <Shield className="w-3.5 h-3.5 text-accent/40" />
                                <p className="text-[10px] text-white/30 uppercase tracking-widest">Stripe Connect Live Checkout</p>
                            </div>
                        </div>
                    )}

                    {/* SUCCESS */}
                    {step === 'in_app_success' && (
                        <div className="py-8 text-center space-y-5">
                            <div className="w-20 h-20 rounded-full bg-accent/10 border-2 border-accent/30 flex items-center justify-center mx-auto">
                                <CheckCircle2 className="w-10 h-10 text-accent" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white mb-1">Payment Sent!</h3>
                                <p className="text-sm text-white/40">
                                    ${settlement.amount.toFixed(2)} sent to {recipientName}
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
                                            <p className="text-lg font-black text-accent">${settlement.amount.toFixed(2)}</p>
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
            
            <LinkBankModal 
                isOpen={showLinkModal} 
                onClose={() => setShowLinkModal(false)}
                onSuccess={() => { setShowLinkModal(false); loadBanks(); }}
            />
        </div>
    );
}
