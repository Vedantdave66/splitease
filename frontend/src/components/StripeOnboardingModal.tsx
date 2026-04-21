import { useState } from 'react';
import { X, Lock, ExternalLink, Loader2, Landmark, Wallet, ShieldCheck, Zap, ArrowRight, CheckCircle2 } from 'lucide-react';
import { stripeApi } from '../services/api';

interface StripeOnboardingModalProps {
    onClose: () => void;
    returnPath?: string;
}

export default function StripeOnboardingModal({ onClose, returnPath = '/dashboard' }: StripeOnboardingModalProps) {
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleConnect = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await stripeApi.onboard(returnPath);
            window.location.href = res.url;
        } catch (err: any) {
            setError(err.message || 'Failed to start onboarding flow.');
            setLoading(false);
        }
    };

    const handleNext = () => {
        if (step < 2) setStep(step + 1);
        else handleConnect();
    };

    const slides = [
        {
            icon: <Wallet className="w-8 h-8 text-indigo" />,
            title: "We don't hold your money",
            desc: "When friends pay you, the funds go straight into your bank account. TandemPay never holds your cash."
        },
        {
            icon: <ShieldCheck className="w-8 h-8 text-indigo" />,
            title: "Bank-grade security",
            desc: "We partner with Stripe to encrypt and protect your data. We never see your routing or account numbers."
        },
        {
            icon: <Zap className="w-8 h-8 text-indigo" />,
            title: "Takes 2 minutes",
            desc: "Have your debit card or bank account details ready. Once connected, you can receive unlimited payments."
        }
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
            
            <div className="relative bg-surface border border-border rounded-3xl w-full max-w-sm shadow-[0_25px_60px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col transform transition-all">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo/5 rounded-full blur-[80px] pointer-events-none" />
                
                <div className="p-8 pb-4 text-center relative z-10 flex flex-col items-center min-h-[220px]">
                    <div className="w-16 h-16 rounded-2xl bg-indigo/10 border border-indigo/20 flex flex-col items-center justify-center mb-6 mx-auto shadow-inner shadow-indigo/5 transition-all animate-in zoom-in duration-300" key={step}>
                        {slides[step].icon}
                    </div>
                    
                    <h2 className="text-xl font-black text-primary mb-3 animate-in slide-in-from-bottom-2 duration-300" key={`title-${step}`}>
                        {slides[step].title}
                    </h2>
                    <p className="text-sm text-secondary px-2 leading-relaxed animate-in slide-in-from-bottom-2 duration-300 delay-75" key={`desc-${step}`}>
                        {slides[step].desc}
                    </p>
                </div>

                <div className="flex justify-center gap-2 mb-2 z-10">
                    {[0, 1, 2].map(i => (
                        <div 
                            key={i} 
                            className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-indigo' : 'w-1.5 bg-border'}`} 
                        />
                    ))}
                </div>

                <div className="px-6 py-5 flex flex-col gap-3 relative z-10">
                    {error && (
                        <div className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 p-2 rounded-lg text-center animate-in fade-in">
                            {error}
                        </div>
                    )}
                    
                    <button
                        onClick={handleNext}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 bg-indigo hover:bg-indigo-hover text-white font-bold py-3.5 rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo/20 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : step === 2 ? 'Connect Bank Securely' : 'Continue'}
                        {!loading && step < 2 && <ArrowRight className="w-4 h-4" />}
                        {!loading && step === 2 && <ExternalLink className="w-4 h-4 opacity-50" />}
                    </button>
                    
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="w-full py-2.5 text-sm font-semibold text-secondary hover:text-primary transition-colors cursor-pointer"
                    >
                        Maybe later
                    </button>
                </div>
                
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-lg text-secondary hover:text-primary hover:bg-white/5 transition-colors cursor-pointer"
                    aria-label="Close"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
