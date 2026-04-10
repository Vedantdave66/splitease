import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { X, Loader2, ShieldCheck, CheckCircle2, Clock } from 'lucide-react';
import { paymentsApi, stripeApi } from '../services/api';
import { formatCurrency } from '../utils/currency';

// Stripe public key - ideally loaded from env
const stripePromise = loadStripe((import.meta.env.VITE_STRIPE_PUBLIC_KEY as string) || 'pk_test_TYooMQauvdEDq54NiTphI7jx');

type UIState = 'idle' | 'submitting' | 'verifying' | 'success' | 'error' | 'timeout';

function CheckoutForm({ 
    amount, 
    paymentId,
    onSuccess, 
    onCancel 
}: { 
    amount: number; 
    paymentId: string;
    onSuccess: () => void; 
    onCancel: () => void;
}) {
    const stripe = useStripe();
    const elements = useElements();
    const [state, setState] = useState<UIState>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const startPolling = async (pid: string) => {
        setState('verifying');
        const startTime = Date.now();
        
        const interval = setInterval(async () => {
            const elapsed = Date.now() - startTime;
            
            try {
                const res = await paymentsApi.reconcile(pid);
                if (res.status === 'succeeded') {
                    clearInterval(interval);
                    setState('success');
                    setTimeout(onSuccess, 2000);
                } else if (res.status === 'failed' || res.status === 'expired') {
                    clearInterval(interval);
                    setErrorMessage(res.status === 'expired' ? "Payment session expired. Please restart." : "Payment failed. Please try another card.");
                    setState('error');
                }
            } catch (err) {
                console.error("Polling error:", err);
            }

            // Timeout after 10 seconds -> Move to 'timeout' state but keep polling in background if helpful
            // Requirement says "Show 'Still processing', Trigger reconciliation, Continue polling"
            if (elapsed > 10000 && state === 'verifying') {
                setState('timeout');
                // We keep the interval running
            }
        }, 2000); // 2-3s interval as requested
        
        return () => clearInterval(interval);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stripe || !elements || state !== 'idle') return;

        setState('submitting');
        setErrorMessage(null);

        // STEP 1: Strict elements.submit()
        const { error: submitError } = await elements.submit();
        if (submitError) {
            setErrorMessage(submitError.message || "Validation failed.");
            setState('idle');
            return;
        }

        // STEP 2: confirmPayment()
        const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: window.location.href, // Fallback for redirects
            },
            redirect: "if_required",
        });

        if (error) {
            // Check if it's a real error or just a redirect happening
            if (error.type === "card_error" || error.type === "validation_error") {
                setErrorMessage(error.message || "An error occurred.");
                setState('idle');
            } else {
                // For other errors, we might be in an uncertain state, start verifying
                startPolling(paymentId);
            }
        } else if (paymentIntent) {
            // STEP 3: Move to verifying ONLY. NEVER success immediately.
            startPolling(paymentId);
        }
    };

    if (state === 'success') {
        return (
            <div className="py-8 text-center animate-in fade-in zoom-in duration-500">
                <div className="w-20 h-20 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-10 h-10 text-accent" />
                </div>
                <h3 className="text-2xl font-bold text-primary mb-2">Payment Confirmed</h3>
                <p className="text-sm text-secondary">Stripe and TandemPay have finalized your transaction.</p>
            </div>
        );
    }

    if (state === 'verifying' || state === 'timeout') {
        return (
            <div className="py-12 text-center animate-in fade-in">
                <div className="relative w-16 h-16 mx-auto mb-6">
                    <Loader2 className="w-16 h-16 text-indigo animate-spin" />
                    {state === 'timeout' && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Clock className="w-6 h-6 text-indigo opacity-50" />
                        </div>
                    )}
                </div>
                <h3 className="text-xl font-bold text-primary mb-2">
                    {state === 'timeout' ? "Still processing..." : "Verifying with Stripe..."}
                </h3>
                <p className="text-sm text-secondary max-w-xs mx-auto leading-relaxed">
                    {state === 'timeout' 
                        ? "Still processing — check activity later. We'll update your dashboard once Stripe confirms the transfer." 
                        : "Almost there! We're confirming the transfer with your bank."}
                </p>
                {state === 'timeout' && (
                    <button
                        onClick={onCancel}
                        className="mt-8 px-8 py-3 bg-surface hover:bg-border text-primary font-bold rounded-xl border border-border transition-all cursor-pointer"
                    >
                        Close & Check Activity
                    </button>
                )}
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <PaymentElement 
                options={{ 
                    wallets: { applePay: 'never', googlePay: 'never' },
                    layout: 'tabs'
                }} 
            />
            
            {errorMessage && (
                <div className="p-4 bg-danger/10 border border-danger/20 rounded-xl text-sm font-medium text-danger animate-in shake">
                    {errorMessage}
                </div>
            )}

            <div className="flex gap-3 pt-2">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={state === 'submitting'}
                    className="flex-1 py-4 bg-surface hover:bg-border text-primary font-bold rounded-2xl transition-all"
                >
                    Back
                </button>
                <button
                    type="submit"
                    disabled={!stripe || state !== 'idle'}
                    className="flex-[2] py-4 bg-indigo hover:bg-indigo-hover text-white font-bold rounded-2xl flex items-center justify-center shadow-xl shadow-indigo/20 disabled:opacity-50"
                >
                    {state === 'submitting' ? <Loader2 className="w-6 h-6 animate-spin" /> : `Pay $${formatCurrency(amount)}`}
                </button>
            </div>
        </form>
    );
}

interface StripePaymentModalProps {
    payeeId: string;
    amount: number;
    settlementId?: string;
    onClose: () => void;
    onSuccess: () => void;
}

export default function StripePaymentModal({
    payeeId,
    amount,
    settlementId,
    onClose,
    onSuccess
}: StripePaymentModalProps) {
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [paymentId, setPaymentId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // PERSISTENT RECOVERY (CRITICAL)
    useEffect(() => {
        const initPayment = async () => {
            try {
                const res = await paymentsApi.create({
                    payee_id: payeeId,
                    amount: Math.round(amount * 100),
                    settlement_id: settlementId,
                });
                
                if (res.status === 'already_completed') {
                    onSuccess();
                    onClose();
                    return;
                }

                setClientSecret(res.client_secret);
                setPaymentId(res.payment_id);
            } catch (err: any) {
                setError(err.message || 'Payment initialization failed.');
            } finally {
                setLoading(false);
            }
        };

        if (payeeId && amount > 0) {
            initPayment();
        }
    }, [payeeId, amount, settlementId]);

    const RedirectHandler = () => {
        const stripe = useStripe();
        useEffect(() => {
            if (!stripe) return;
            const params = new URLSearchParams(window.location.search);
            const cs = params.get("payment_intent_client_secret");
            if (cs) {
                stripe.retrievePaymentIntent(cs).then(({paymentIntent}) => {
                    if (paymentIntent?.status === "succeeded") {
                        onSuccess();
                        onClose();
                    }
                });
            }
        }, [stripe]);
        return null;
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-bg/80 backdrop-blur-md">
            <div className="bg-bg border border-border w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between p-7 border-b border-border bg-surface/30">
                    <div>
                        <h2 className="text-2xl font-black text-primary tracking-tight">Secure Payment</h2>
                        <div className="flex items-center gap-1.5 mt-1 bg-accent/10 px-2 py-0.5 rounded-full w-fit">
                            <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                            <span className="text-[10px] uppercase font-bold text-accent tracking-wider">Processed by Stripe</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 bg-surface hover:bg-border rounded-2xl transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-8">
                    {loading ? (
                        <div className="py-16 text-center">
                            <Loader2 className="w-12 h-12 text-indigo animate-spin mx-auto mb-6" />
                            <p className="text-secondary font-bold animate-pulse">Establishing Secure Tunnel...</p>
                        </div>
                    ) : error ? (
                        <div className="py-8 text-center">
                            <div className="w-16 h-16 bg-danger/10 rounded-full flex items-center justify-center mx-auto mb-6 text-danger">
                                <X className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-bold text-primary mb-2">Initialization Failed</h3>
                            <p className="text-sm text-secondary mb-8">{error}</p>
                            <button onClick={onClose} className="w-full py-4 bg-primary text-bg font-bold rounded-2xl">Return</button>
                        </div>
                    ) : clientSecret && (
                        <Elements 
                            key={clientSecret} 
                            stripe={stripePromise} 
                            options={{ clientSecret, appearance: { theme: 'night', variables: { colorPrimary: '#3ECF8E' } } }}
                        >
                            <RedirectHandler />
                            <CheckoutForm 
                                amount={amount} 
                                paymentId={paymentId || ''}
                                onSuccess={() => { onSuccess(); onClose(); }} 
                                onCancel={onClose} 
                            />
                        </Elements>
                    )}
                </div>
            </div>
        </div>
    );
}
