import { useEffect, useState } from 'react';
import { X, Send, Building2, CreditCard, Copy, CheckCircle2, ArrowRight, Loader2, Shield, Landmark, Wallet } from 'lucide-react';
import { Settlement, settlementRecordsApi, walletApi, requestsApi } from '../services/api';
import Avatar from './Avatar';

interface SettleUpModalProps {
    groupId: string;
    settlement: Settlement;
    currentUserId: string;
    onClose: () => void;
    onSettled: () => void;
}

type Step = 'method' | 'etransfer' | 'in_app_link' | 'in_app_confirm' | 'in_app_processing' | 'in_app_success' | 'sent_confirmation';

export default function SettleUpModal({ groupId, settlement, currentUserId, onClose, onSettled }: SettleUpModalProps) {
    const [step, setStep] = useState<Step>('method');
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState('');
    const [walletBalance, setWalletBalance] = useState<number | null>(null);

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
            await settlementRecordsApi.create(groupId, {
                payee_id: settlement.to_user_id,
                amount: settlement.amount,
                method,
            });
            if (method === 'etransfer') {
                setStep('etransfer');
            } else {
                setStep('in_app_link');
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
            // Get the latest settlement record
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

    // In-App flow simulation
    const handleInAppConfirm = () => {
        setStep('in_app_processing');
        setTimeout(() => {
            setStep('in_app_success');
        }, 2500);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

            <div className="relative bg-[#0C0E14] border border-[#1E2230]/80 rounded-3xl w-full max-w-md mx-4 shadow-[0_25px_60px_rgba(0,0,0,0.6)] overflow-hidden">
                {/* Ambient glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-40 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

                {/* Header */}
                <div className="relative flex items-center justify-between p-6 pb-4">
                    <h2 className="text-lg font-bold text-white">
                        {step === 'method' && 'Settle Up'}
                        {step === 'etransfer' && 'E-Transfer'}
                        {step === 'in_app_link' && 'Link Account'}
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

                {/* Content */}
                <div className="relative px-6 pb-6">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl p-3 mb-4">
                            {error}
                        </div>
                    )}

                    {/* ======= STEP: METHOD SELECTION ======= */}
                    {step === 'method' && (
                        <div className="space-y-5">
                            {/* Amount display */}
                            <div className="text-center py-4">
                                <div className="flex items-center justify-center gap-3 mb-4">
                                    <Avatar name={settlement.from_user_name} color={settlement.from_avatar_color} size="md" />
                                    <ArrowRight className="w-5 h-5 text-accent" />
                                    <Avatar name={settlement.to_user_name} color={settlement.to_avatar_color} size="md" />
                                </div>
                                <p className="text-sm text-white/50 mb-1">Amount to settle</p>
                                <p className="text-4xl font-black text-white tracking-tight">
                                    ${settlement.amount.toFixed(2)}
                                </p>
                                <p className="text-sm text-white/40 mt-2">
                                    {settlement.from_user_name} → {settlement.to_user_name}
                                </p>
                            </div>

                            {/* Method buttons */}
                            <div className="space-y-3">
                                <button
                                    onClick={() => handleInitiateSettlement('in_app')}
                                    disabled={loading || walletBalance === null || walletBalance < settlement.amount}
                                    className="w-full flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-accent/10 to-accent/5 border border-accent/20 hover:border-accent/40 transition-all duration-300 cursor-pointer group disabled:opacity-50"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center group-hover:bg-accent/30 transition-colors">
                                        <Wallet className="w-6 h-6 text-accent" />
                                    </div>
                                    <div className="text-left flex-1">
                                        <p className="text-sm font-bold text-white mb-0.5">Pay with Wallet</p>
                                        <div className="flex items-center gap-2">
                                            {walletBalance !== null ? (
                                                <>
                                                    <span className={`text-xs font-bold ${walletBalance >= settlement.amount ? 'text-accent' : 'text-danger'}`}>
                                                        ${walletBalance.toFixed(2)} Available
                                                    </span>
                                                    {walletBalance < settlement.amount && (
                                                        <span className="text-[10px] text-white/40 uppercase tracking-widest bg-white/5 px-1.5 py-0.5 rounded-sm">Add Funds</span>
                                                    )}
                                                </>
                                            ) : (
                                                <span className="text-xs text-white/40">Loading balance...</span>
                                            )}
                                        </div>
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
                                        <p className="text-sm font-bold text-white">E-Transfer</p>
                                        <p className="text-xs text-white/40">Send via your banking app</p>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-indigo transition-colors" />
                                </button>
                            </div>

                            {loading && (
                                <div className="flex items-center justify-center py-2">
                                    <Loader2 className="w-5 h-5 text-accent animate-spin" />
                                </div>
                            )}
                        </div>
                    )}

                    {/* ======= STEP: E-TRANSFER ======= */}
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
                                    <div className="flex items-center justify-between bg-[#09090B] rounded-xl px-4 py-3 border border-white/5">
                                        <div>
                                            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-0.5">Email</p>
                                            <p className="text-sm font-bold text-white">{recipientEmail}</p>
                                        </div>
                                        <button
                                            onClick={handleCopyEmail}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
                                        >
                                            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-accent" /> : <Copy className="w-3.5 h-3.5 text-white/50" />}
                                            <span className="text-xs text-white/60">{copied ? 'Copied' : 'Copy'}</span>
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between bg-[#09090B] rounded-xl px-4 py-3 border border-white/5">
                                        <div>
                                            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-0.5">Amount</p>
                                            <p className="text-lg font-black text-accent">${settlement.amount.toFixed(2)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-start gap-3 p-4 rounded-xl bg-indigo/5 border border-indigo/20">
                                <Send className="w-4 h-4 text-indigo mt-0.5 shrink-0" />
                                <p className="text-xs text-white/50 leading-relaxed">
                                    Send the e-transfer using your banking app, then tap the button below to let {recipientName} know.
                                </p>
                            </div>

                            <button
                                onClick={handleMarkSent}
                                disabled={loading}
                                className="w-full bg-gradient-to-r from-accent to-emerald-500 hover:from-accent-hover hover:to-emerald-600 text-[#064E3B] font-bold py-3.5 rounded-xl transition-all duration-300 disabled:opacity-50 cursor-pointer shadow-lg shadow-accent/20 hover:shadow-accent/30"
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                                ) : (
                                    "I've Sent the Money"
                                )}
                            </button>
                        </div>
                    )}

                    {/* ======= STEP: IN-APP LINK ACCOUNT ======= */}
                    {step === 'in_app_link' && (
                        <div className="space-y-5">
                            <div className="text-center py-3">
                                <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4 border border-accent/20">
                                    <Landmark className="w-8 h-8 text-accent" />
                                </div>
                                <h3 className="text-base font-bold text-white mb-1">Link Your Bank</h3>
                                <p className="text-xs text-white/40">Securely connect your account for instant payments</p>
                            </div>

                            {/* Simulated bank options */}
                            {['TD Canada Trust', 'RBC Royal Bank', 'Scotiabank', 'BMO'].map((bank) => (
                                <button
                                    key={bank}
                                    onClick={() => setStep('in_app_confirm')}
                                    className="w-full flex items-center gap-4 p-3.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-accent/30 transition-all duration-200 cursor-pointer group"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                                        <Building2 className="w-5 h-5 text-white/40" />
                                    </div>
                                    <span className="text-sm font-medium text-white/80 flex-1 text-left">{bank}</span>
                                    <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-accent transition-colors" />
                                </button>
                            ))}

                            <div className="flex items-center gap-2 justify-center pt-2">
                                <Shield className="w-3.5 h-3.5 text-accent/40" />
                                <p className="text-[10px] text-white/30 uppercase tracking-widest">256-bit Encrypted</p>
                            </div>
                        </div>
                    )}

                    {/* ======= STEP: IN-APP CONFIRM ======= */}
                    {step === 'in_app_confirm' && (
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
                                        <span className="text-white/70">SplitEase Wallet</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-white/40">Available Balance</span>
                                        <span className="text-white/70">${walletBalance?.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs mt-2 pt-2 border-t border-white/5">
                                        <span className="text-white/40">Fee</span>
                                        <span className="text-accent font-medium">Free</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-white/40">Arrives</span>
                                        <span className="text-white/70">Instantly via Ledger</span>
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

                    {/* ======= STEP: IN-APP PROCESSING ======= */}
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
                                <p className="text-sm text-white/40">Securely transferring funds...</p>
                            </div>
                            <div className="flex items-center gap-2 justify-center">
                                <Shield className="w-3.5 h-3.5 text-accent/40" />
                                <p className="text-[10px] text-white/30 uppercase tracking-widest">Encrypted & Secure</p>
                            </div>
                        </div>
                    )}

                    {/* ======= STEP: IN-APP SUCCESS ======= */}
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
                            <div className="bg-accent/5 border border-accent/20 rounded-xl p-3">
                                <p className="text-xs text-white/50">{recipientName} will be asked to confirm receipt.</p>
                            </div>
                            <button
                                onClick={() => { onSettled(); onClose(); }}
                                className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-white font-semibold py-3 rounded-xl transition-all duration-200 cursor-pointer"
                            >
                                Done
                            </button>
                        </div>
                    )}

                    {/* ======= STEP: SENT CONFIRMATION (E-Transfer) ======= */}
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
                            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                                <p className="text-xs text-amber-200/60">
                                    The balance will only be settled once {recipientName} confirms receipt.
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
        </div>
    );
}
