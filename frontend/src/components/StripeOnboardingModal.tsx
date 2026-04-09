import { useState } from 'react';
import { X, Lock, ExternalLink, Loader2, Landmark } from 'lucide-react';
import { stripeApi } from '../services/api';

interface StripeOnboardingModalProps {
    onClose: () => void;
    returnPath?: string;
}

export default function StripeOnboardingModal({ onClose, returnPath = '/dashboard' }: StripeOnboardingModalProps) {
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
            
            <div className="relative bg-surface border border-border rounded-3xl w-full max-w-sm shadow-[0_25px_60px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col transform transition-all">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo/5 rounded-full blur-[80px] pointer-events-none" />
                
                <div className="p-6 pb-2 text-center relative z-10 flex flex-col items-center">
                    <div className="w-16 h-16 rounded-2xl bg-indigo/10 border border-indigo/20 flex flex-col items-center justify-center mb-5 mx-auto shadow-inner shadow-indigo/5">
                        <Landmark className="w-8 h-8 text-indigo" />
                    </div>
                    
                    <h2 className="text-xl font-black text-primary mb-2">Get paid instantly</h2>
                    <p className="text-sm text-secondary px-2 leading-relaxed mb-1">
                        To receive money directly into your bank, connect securely with Stripe.
                    </p>
                    <p className="text-xs font-semibold text-indigo">
                        Funds arrive in 1–3 business days
                    </p>
                </div>

                <div className="px-6 py-4 flex flex-col gap-3 relative z-10">
                    <div className="bg-indigo/5 border border-indigo/20 rounded-xl p-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo/10 flex items-center justify-center shrink-0">
                            <Lock className="w-4 h-4 text-indigo" />
                        </div>
                        <div className="flex-1 text-left">
                            <p className="text-sm font-bold text-primary">Secure and encrypted</p>
                            <p className="text-xs font-semibold text-indigo">Powered by Stripe</p>
                        </div>
                    </div>
                    
                    {error && (
                        <div className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 p-2 rounded-lg text-center">
                            {error}
                        </div>
                    )}
                    
                    <button
                        onClick={handleConnect}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 bg-indigo hover:bg-indigo-hover text-white font-bold py-3.5 rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo/20 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Connect Bank Securely'}
                        {!loading && <ExternalLink className="w-4 h-4 opacity-50" />}
                    </button>
                    
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="w-full py-2.5 text-sm font-semibold text-secondary hover:text-primary transition-colors cursor-pointer"
                    >
                        Not now
                    </button> //
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
