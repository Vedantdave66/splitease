import { useState, useCallback, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { X, CheckCircle2, ShieldCheck, Landmark } from 'lucide-react';
import { plaidApi } from '../services/api';

interface LinkBankModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function LinkBankModal({ isOpen, onClose, onSuccess }: LinkBankModalProps) {
    const [step, setStep] = useState<'intro' | 'connecting' | 'success'>('intro');
    const [linkToken, setLinkToken] = useState<string | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && !linkToken) {
            // Fetch link token from backend when modal opens
            plaidApi.createLinkToken()
                .then(res => setLinkToken(res.link_token))
                .catch(err => setError(err.message || 'Failed to initialize Plaid'));
        }
    }, [isOpen, linkToken]);

    const onSuccessPlaid = useCallback(async (public_token: string, metadata: any) => {
        setStep('connecting');
        setError('');
        
        try {
            const institution = metadata.institution;
            const account = metadata.accounts && metadata.accounts.length > 0 ? metadata.accounts[0] : null;
            
            if (!account) throw new Error("No account was selected");

            await plaidApi.setAccessToken(
                public_token, 
                institution.institution_id, 
                institution.name, 
                account.id
            );
            
            setStep('success');
            setTimeout(() => {
                onSuccess();
                handleClose();
            }, 2000);
            
        } catch (err: any) {
            setError(err.message || 'Failed to link account securely.');
            setStep('intro');
        }
    }, [onSuccess]);

    const config = {
        token: linkToken!,
        onSuccess: onSuccessPlaid,
        onExit: (err: any, metadata: any) => {
            if (err) setError(err.message || 'User exited or error occurred');
        }
    };

    const { open, ready } = usePlaidLink(config);

    if (!isOpen) return null;

    const handleClose = () => {
        setTimeout(() => {
            setStep('intro');
            setError('');
        }, 300);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-surface border border-border rounded-3xl w-full max-w-md shadow-2xl overflow-hidden relative">

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
                    {step === 'intro' && (
                        <div className="space-y-6 text-center animate-in slide-in-from-right-4">
                            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-indigo/10 border border-indigo/20 mb-2">
                                <Landmark className="w-10 h-10 text-indigo" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-primary mb-2">Link your bank account</h2>
                                <p className="text-secondary text-sm">
                                    Tandem uses Plaid to securely connect your accounts. We never see or store your login credentials.
                                </p>
                            </div>

                            <ul className="text-left space-y-4 bg-bg rounded-2xl p-5 border border-border mb-6">
                                <li className="flex gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />
                                    <span className="text-sm text-secondary">Instantly withdraw wallet funds</span>
                                </li>
                                <li className="flex gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />
                                    <span className="text-sm text-secondary">Pay group balances directly</span>
                                </li>
                                <li className="flex gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />
                                    <span className="text-sm text-secondary">Bank-level encryption standards</span>
                                </li>
                            </ul>

                            {error && <p className="text-sm text-danger text-center font-medium mb-4">{error}</p>}

                            <button
                                onClick={() => open()}
                                disabled={!ready || !linkToken}
                                className="w-full py-4 rounded-xl font-bold text-white bg-indigo hover:bg-indigo-hover transition-colors shadow-lg shadow-indigo/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {!linkToken ? 'Initializing Plaid...' : 'Continue with Plaid'}
                            </button>
                        </div>
                    )}

                    {step === 'connecting' && (
                        <div className="py-12 flex flex-col items-center justify-center space-y-6 animate-in zoom-in-95">
                            <div className="relative">
                                <div className="w-20 h-20 border-4 border-surface-hover rounded-full"></div>
                                <div className="w-20 h-20 border-4 border-emerald-500 rounded-full border-t-transparent animate-spin absolute inset-0"></div>
                                <Landmark className="w-8 h-8 text-emerald-500 absolute inset-0 m-auto animate-pulse" />
                            </div>
                            <div className="text-center space-y-2">
                                <p className="text-lg font-bold text-primary">Securing Connection</p>
                                <p className="text-sm text-secondary">Finalizing setup with your bank...</p>
                            </div>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="py-10 flex flex-col items-center justify-center space-y-4 animate-in zoom-in">
                            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-2 relative">
                                <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping"></div>
                                <CheckCircle2 className="w-10 h-10 text-emerald-500 relative z-10" />
                            </div>
                            <h3 className="text-2xl font-black text-primary">Account Linked</h3>
                            <p className="text-secondary text-sm text-center">Your bank account is now ready to use with Tandem.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
