import { useState } from 'react';
import { X, Building2, CheckCircle2, ChevronRight, Wallet } from 'lucide-react';
import { walletApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface AddFundsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newBalance: number) => void;
}

export default function AddFundsModal({ isOpen, onClose, onSuccess }: AddFundsModalProps) {
    const { user, setUser } = useAuth();
    const [step, setStep] = useState<'amount' | 'bank' | 'processing' | 'success'>('amount');
    const [amount, setAmount] = useState('100');
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleContinueToBank = () => {
        const val = parseFloat(amount);
        if (isNaN(val) || val <= 0) {
            setError('Please enter a valid amount');
            return;
        }
        if (val > 10000) {
            setError('Maximum limit is $10,000');
            return;
        }
        setError('');
        setStep('bank');
    };

    const handleSelectBank = async (bankName: string) => {
        setStep('processing');
        setError('');

        try {
            // Simulate network delay for the dramatic effect of connecting to a bank
            await new Promise((resolve) => setTimeout(resolve, 2000));

            const updatedUser = await walletApi.addFunds(parseFloat(amount), bankName);
            setUser(updatedUser);
            setStep('success');

            // Auto close after 2 seconds
            setTimeout(() => {
                onSuccess(updatedUser.wallet_balance);
                onCloseModal();
            }, 2000);

        } catch (err: any) {
            setError(err.message || 'Failed to add funds. Please try again.');
            setStep('bank'); // Go back so they can retry
        }
    };

    const onCloseModal = () => {
        setStep('amount');
        setAmount('100');
        setError('');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-surface border border-border rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
                {/* Header Container */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <h2 className="text-xl font-bold text-primary">
                        {step === 'amount' && 'Add Funds'}
                        {step === 'bank' && 'Select Source'}
                        {step === 'processing' && 'Processing'}
                        {step === 'success' && 'Success'}
                    </h2>
                    {step !== 'processing' && step !== 'success' && (
                        <button
                            onClick={onCloseModal}
                            className="p-2 text-secondary hover:text-primary hover:bg-surface-hover rounded-full transition-colors cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                <div className="p-6">
                    {/* Amount Setup Step */}
                    {step === 'amount' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4">
                            <div className="text-center">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 border border-accent/20 mb-4">
                                    <Wallet className="w-8 h-8 text-accent" />
                                </div>
                                <p className="text-secondary text-sm">How much would you like to add to your Tandem wallet?</p>
                            </div>

                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-secondary">$</span>
                                <input
                                    type="number"
                                    min="1"
                                    max="10000"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="w-full bg-bg border border-border rounded-2xl py-4 pl-10 pr-4 text-3xl font-black text-primary placeholder:text-border focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                                    placeholder="0.00"
                                    autoFocus
                                />
                            </div>

                            {error && <p className="text-sm text-danger text-center font-medium">{error}</p>}

                            <div className="grid grid-cols-3 gap-3">
                                {['50', '100', '250'].map((preset) => (
                                    <button
                                        key={preset}
                                        onClick={() => setAmount(preset)}
                                        className="py-2 rounded-xl border border-border bg-bg hover:bg-surface-hover text-primary font-semibold transition-colors cursor-pointer"
                                    >
                                        ${preset}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={handleContinueToBank}
                                className="w-full py-4 rounded-xl font-bold text-white bg-accent hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20 cursor-pointer"
                            >
                                Continue
                            </button>
                        </div>
                    )}

                    {/* Bank Selection Step */}
                    {step === 'bank' && (
                        <div className="space-y-4 animate-in slide-in-from-right-4">
                            <p className="text-sm text-secondary mb-4">Select a linked bank account to transfer ${parseFloat(amount).toFixed(2)}</p>

                            {/* RBC Mock Option */}
                            <button
                                onClick={() => handleSelectBank('RBC Royal Bank')}
                                className="w-full flex items-center justify-between p-4 rounded-2xl border border-indigo/30 bg-indigo/5 hover:bg-indigo/10 transition-colors group cursor-pointer"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm">
                                        {/* Stylized RBC look */}
                                        <div className="text-[#0055A5] font-black text-lg">RBC</div>
                                    </div>
                                    <div className="text-left">
                                        <p className="font-bold text-primary">RBC Royal Bank</p>
                                        <p className="text-xs text-secondary">Checking •••• 1234</p>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-secondary group-hover:text-indigo transition-colors" />
                            </button>

                            {/* Generic Mock Option */}
                            <button
                                onClick={() => handleSelectBank('TD Bank')}
                                className="w-full flex items-center justify-between p-4 rounded-2xl border border-border bg-bg hover:bg-surface-hover transition-colors group cursor-pointer"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-[#008A00] flex items-center justify-center shadow-sm">
                                        <Building2 className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="text-left">
                                        <p className="font-bold text-primary">TD Canada Trust</p>
                                        <p className="text-xs text-secondary">Savings •••• 9876</p>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-secondary group-hover:text-primary transition-colors" />
                            </button>

                            <button className="w-full py-4 rounded-xl font-semibold text-secondary hover:text-primary border border-dashed border-border hover:border-accent/50 transition-colors mt-4 text-sm cursor-pointer">
                                + Link another institution
                            </button>

                            {error && <p className="text-sm text-danger text-center font-medium mt-4">{error}</p>}
                        </div>
                    )}

                    {/* Processing Step */}
                    {step === 'processing' && (
                        <div className="py-12 flex flex-col items-center justify-center space-y-6 animate-in zoom-in-95">
                            <div className="relative">
                                <div className="w-20 h-20 border-4 border-surface-hover rounded-full"></div>
                                <div className="w-20 h-20 border-4 border-indigo rounded-full border-t-transparent animate-spin absolute inset-0"></div>
                                <Building2 className="w-8 h-8 text-indigo absolute inset-0 m-auto animate-pulse" />
                            </div>
                            <div className="text-center space-y-2">
                                <p className="text-lg font-bold text-primary">Securely Transferring</p>
                                <p className="text-sm text-secondary">Communicating with your bank...</p>
                            </div>
                        </div>
                    )}

                    {/* Success Step */}
                    {step === 'success' && (
                        <div className="py-10 flex flex-col items-center justify-center space-y-4 animate-in zoom-in">
                            <div className="w-20 h-20 bg-accent/20 rounded-full flex items-center justify-center mb-2 relative">
                                <div className="absolute inset-0 bg-accent/20 rounded-full animate-ping"></div>
                                <CheckCircle2 className="w-10 h-10 text-accent relative z-10" />
                            </div>
                            <h3 className="text-2xl font-black text-primary">${parseFloat(amount).toFixed(2)} Added!</h3>
                            <p className="text-secondary text-sm">Your Tandem wallet has been funded.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
