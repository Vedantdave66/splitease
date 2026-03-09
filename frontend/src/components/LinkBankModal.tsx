import { useState } from 'react';
import { X, Building2, CheckCircle2, ShieldCheck, Landmark } from 'lucide-react';
import { bankLinksApi } from '../services/api';

interface LinkBankModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const INSTITUTIONS = [
    { name: 'RBC Royal Bank', icon: 'RBC', color: 'bg-white text-[#0055A5] font-black', border: 'border-indigo/30' },
    { name: 'TD Canada Trust', icon: <Building2 className="w-6 h-6 text-white" />, color: 'bg-[#008A00]', border: 'border-border' },
    { name: 'Scotiabank', icon: 'S', color: 'bg-[#E3000F] text-white font-black', border: 'border-red-500/30' },
    { name: 'BMO', icon: 'M', color: 'bg-[#0079C1] text-white font-black', border: 'border-blue-500/30' },
];

export default function LinkBankModal({ isOpen, onClose, onSuccess }: LinkBankModalProps) {
    const [step, setStep] = useState<'intro' | 'select' | 'connecting' | 'success'>('intro');
    const [selectedBank, setSelectedBank] = useState<string | null>(null);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSelectBank = async (bankName: string) => {
        setSelectedBank(bankName);
        setStep('connecting');
        setError('');

        try {
            // Simulate Plaid auth flow delay
            await new Promise((resolve) => setTimeout(resolve, 2500));

            // Randomly generate a mock account mask, e.g "4912"
            const mask = Math.floor(1000 + Math.random() * 9000).toString();

            await bankLinksApi.link(bankName, mask, 'plaid');
            setStep('success');

            setTimeout(() => {
                onSuccess();
                handleClose();
            }, 2000);

        } catch (err: any) {
            setError(err.message || 'Failed to connect institution. Please try again.');
            setStep('select');
        }
    };

    const handleClose = () => {
        setTimeout(() => {
            setStep('intro');
            setSelectedBank(null);
            setError('');
        }, 300);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-surface border border-border rounded-3xl w-full max-w-md shadow-2xl overflow-hidden relative">

                {/* Simulated Plaid Header */}
                <div className="flex items-center justify-between p-6 border-b border-border bg-black/40">
                    <div className="flex items-center gap-2 text-secondary">
                        <ShieldCheck className="w-5 h-5 text-emerald-500" />
                        <span className="text-xs font-semibold tracking-wider uppercase">Secured by Plaid</span>
                    </div>
                    {step !== 'connecting' && step !== 'success' && (
                        <button
                            onClick={handleClose}
                            className="p-2 text-secondary hover:text-primary hover:bg-surface-hover rounded-full transition-colors cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                <div className="p-6">
                    {/* Intro Step */}
                    {step === 'intro' && (
                        <div className="space-y-6 text-center animate-in slide-in-from-right-4">
                            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-indigo/10 border border-indigo/20 mb-2">
                                <Landmark className="w-10 h-10 text-indigo" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-primary mb-2">Link your bank account</h2>
                                <p className="text-secondary text-sm">
                                    SplitEase uses Plaid to securely connect your accounts. We never see or store your login credentials.
                                </p>
                            </div>

                            <ul className="text-left space-y-4 bg-bg rounded-2xl p-5 border border-border mb-6">
                                <li className="flex gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />
                                    <span className="text-sm text-secondary">Instantly withdraw wallet funds</span>
                                </li>
                                <li className="flex gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />
                                    <span className="text-sm text-secondary">Settle group debts directly</span>
                                </li>
                                <li className="flex gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />
                                    <span className="text-sm text-secondary">Bank-level encryption standards</span>
                                </li>
                            </ul>

                            <button
                                onClick={() => setStep('select')}
                                className="w-full py-4 rounded-xl font-bold text-white bg-indigo hover:bg-indigo-hover transition-colors shadow-lg shadow-indigo/20 cursor-pointer"
                            >
                                Continue
                            </button>
                        </div>
                    )}

                    {/* Selection Step */}
                    {step === 'select' && (
                        <div className="space-y-4 animate-in slide-in-from-right-4">
                            <h2 className="text-xl font-bold text-primary mb-4">Select Institution</h2>

                            <div className="grid gap-3">
                                {INSTITUTIONS.map((bank) => (
                                    <button
                                        key={bank.name}
                                        onClick={() => handleSelectBank(bank.name)}
                                        className={`w-full flex items-center gap-4 p-4 rounded-2xl border ${bank.border} bg-bg hover:bg-surface-hover transition-colors group cursor-pointer`}
                                    >
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-sm ${bank.color}`}>
                                            {typeof bank.icon === 'string' ? (
                                                <span className="text-lg">{bank.icon}</span>
                                            ) : (
                                                bank.icon
                                            )}
                                        </div>
                                        <p className="font-bold text-primary group-hover:text-indigo transition-colors">{bank.name}</p>
                                    </button>
                                ))}
                            </div>

                            <div className="mt-4 pt-4 border-t border-border flex justify-center">
                                <button className="text-xs font-semibold text-secondary hover:text-primary transition-colors cursor-pointer">
                                    Search for another institution
                                </button>
                            </div>

                            {error && <p className="text-sm text-danger text-center font-medium mt-4">{error}</p>}
                        </div>
                    )}

                    {/* Connecting Step */}
                    {step === 'connecting' && (
                        <div className="py-12 flex flex-col items-center justify-center space-y-6 animate-in zoom-in-95">
                            <div className="relative">
                                <div className="w-20 h-20 border-4 border-surface-hover rounded-full"></div>
                                <div className="w-20 h-20 border-4 border-emerald-500 rounded-full border-t-transparent animate-spin absolute inset-0"></div>
                                <Landmark className="w-8 h-8 text-emerald-500 absolute inset-0 m-auto animate-pulse" />
                            </div>
                            <div className="text-center space-y-2">
                                <p className="text-lg font-bold text-primary">Authenticating</p>
                                <p className="text-sm text-secondary">Establishing secure connection to {selectedBank}...</p>
                            </div>
                        </div>
                    )}

                    {/* Success Step */}
                    {step === 'success' && (
                        <div className="py-10 flex flex-col items-center justify-center space-y-4 animate-in zoom-in">
                            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-2 relative">
                                <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping"></div>
                                <CheckCircle2 className="w-10 h-10 text-emerald-500 relative z-10" />
                            </div>
                            <h3 className="text-2xl font-black text-primary">Account Linked</h3>
                            <p className="text-secondary text-sm text-center">Your {selectedBank} account is now ready to use with SplitEase.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
