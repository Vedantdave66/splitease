import React, { useState, useEffect, useCallback, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { X, Loader2, ShieldCheck, CheckCircle2, Clock, AlertTriangle, Lock } from 'lucide-react';
import { paymentsApi, authApi } from '../services/api';
import { formatCurrency } from '../utils/currency';
import { useAuth } from '../context/AuthContext';

// Stripe public key
const stripePromise = loadStripe((import.meta.env.VITE_STRIPE_PUBLIC_KEY as string) || 'pk_test_TYooMQauvdEDq54NiTphI7jx');

type UIState = 'idle' | 'submitting' | 'verifying' | 'success' | 'error' | 'timeout';

function CheckoutForm({ 
    amount, 
    paymentId,
    clientSecret,
    onSuccess, 
    onCancel 
}: { 
    amount: number; 
    paymentId: string;
    clientSecret: string;
    onSuccess: () => void; 
    onCancel: () => void;
}) {
    const stripe = useStripe();
    const elements = useElements();
    const [state, setState] = useState<UIState>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [elementReady, setElementReady] = useState(false);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const stateRef = useRef<UIState>('idle');

    // Keep ref in sync with state for interval callbacks
    useEffect(() => { stateRef.current = state; }, [state]);

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, []);

    console.log(`[StripePayment] CheckoutForm mounted. stripe=${!!stripe} elements=${!!elements} clientSecret=${clientSecret?.slice(0, 20)}...`);

    const startPolling = useCallback((pid: string) => {
        setState('verifying');
        const startTime = Date.now();
        
        pollingRef.current = setInterval(async () => {
            const elapsed = Date.now() - startTime;
            
            try {
                const res = await paymentsApi.reconcile(pid);
                console.log(`[StripePayment] Poll result: status=${res.status} resolved=${res.resolved}`);

                if (res.status === 'succeeded') {
                    if (pollingRef.current) clearInterval(pollingRef.current);
                    setState('success');
                    setTimeout(onSuccess, 2000);
                } else if (res.status === 'failed' || res.status === 'expired') {
                    if (pollingRef.current) clearInterval(pollingRef.current);
                    setErrorMessage(res.status === 'expired' ? "Payment session expired. Please restart." : "Payment failed. Please try another card.");
                    setState('error');
                }
            } catch (err) {
                console.error("[StripePayment] Polling error:", err);
            }

            // Timeout after 10 seconds
            if (elapsed > 10000 && stateRef.current === 'verifying') {
                setState('timeout');
            }
        }, 2500);
    }, [onSuccess]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!stripe || !elements) {
            console.error('[StripePayment] handleSubmit called but stripe or elements is null');
            setErrorMessage('Payment system not ready. Please wait a moment and try again.');
            return;
        }

        if (state !== 'idle') {
            console.warn(`[StripePayment] handleSubmit called in state=${state}, ignoring`);
            return;
        }

        if (!elementReady) {
            console.warn('[StripePayment] PaymentElement not ready yet');
            setErrorMessage('Payment form is still loading. Please wait.');
            return;
        }

        setState('submitting');
        setErrorMessage(null);

        try {
            // STEP 1: elements.submit() — validates form fields
            console.log('[StripePayment] Step 1: elements.submit()...');
            const { error: submitError } = await elements.submit();
            if (submitError) {
                console.error('[StripePayment] elements.submit() failed:', submitError);
                setErrorMessage(submitError.message || "Please check your card details.");
                setState('idle');
                return;
            }
            console.log('[StripePayment] Step 1 SUCCESS: elements.submit() passed');

            // STEP 2: stripe.confirmPayment() — this attaches the payment method AND confirms
            console.log('[StripePayment] Step 2: stripe.confirmPayment()...');
            const { error, paymentIntent } = await stripe.confirmPayment({
                elements,
                clientSecret,
                confirmParams: {
                    return_url: window.location.href,
                },
                redirect: "if_required",
            });

            if (error) {
                console.error('[StripePayment] confirmPayment error:', error.type, error.message);
                if (error.type === "card_error" || error.type === "validation_error") {
                    setErrorMessage(error.message || "An error occurred with your card.");
                    setState('idle');
                } else {
                    // For other errors (e.g. network issues during 3DS), start polling
                    console.log('[StripePayment] Non-card error, starting verification polling...');
                    startPolling(paymentId);
                }
            } else if (paymentIntent) {
                console.log(`[StripePayment] Step 2 SUCCESS: PI status=${paymentIntent.status}`);
                // Move to verification — NEVER trust client-side success
                startPolling(paymentId);
            }
        } catch (err: any) {
            console.error('[StripePayment] Unexpected error in handleSubmit:', err);
            setErrorMessage(err.message || 'An unexpected error occurred.');
            setState('error');
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
                <div className="mt-6 p-4 bg-accent/10 border border-accent/20 rounded-2xl flex items-center gap-3 text-left">
                    <Clock className="w-8 h-8 text-accent shrink-0" />
                    <div>
                        <p className="text-xs font-bold text-accent uppercase tracking-wider mb-0.5">Estimated Arrival</p>
                        <p className="text-sm font-medium text-primary">
                            Funds will arrive by {
                                new Date(Date.now() + 86400000 * (new Date().getDay() > 3 ? 4 : 2)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            }
                        </p>
                    </div>
                </div>
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

    if (state === 'error') {
        return (
            <div className="py-8 text-center">
                <div className="w-16 h-16 bg-danger/10 rounded-full flex items-center justify-center mx-auto mb-6 text-danger">
                    <AlertTriangle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-primary mb-2">Payment Failed</h3>
                <p className="text-sm text-secondary mb-8">{errorMessage}</p>
                <button onClick={onCancel} className="w-full py-4 bg-primary text-bg font-bold rounded-2xl cursor-pointer">Return</button>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <PaymentElement 
                onReady={() => {
                    console.log('[StripePayment] PaymentElement ready');
                    setElementReady(true);
                }}
                onLoadError={(e) => {
                    console.error('[StripePayment] PaymentElement load error:', e);
                    setErrorMessage('Failed to load payment form. Please close and try again.');
                    setState('error');
                }}
                options={{ 
                    wallets: { applePay: 'auto', googlePay: 'auto' },
                    layout: 'tabs'
                }} 
            />
            
            {errorMessage && state === 'idle' && (
                <div className="p-4 bg-danger/10 border border-danger/20 rounded-xl text-sm font-medium text-danger animate-in shake">
                    {errorMessage}
                </div>
            )}

            <div className="flex gap-3 pt-2">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={state === 'submitting'}
                    className="flex-1 py-4 bg-surface hover:bg-border text-primary font-bold rounded-2xl transition-all cursor-pointer"
                >
                    Back
                </button>
                <button
                    type="submit"
                    disabled={!stripe || !elementReady || state !== 'idle'}
                    className="flex-[2] py-4 bg-indigo hover:bg-indigo-hover text-white font-bold rounded-2xl flex items-center justify-center shadow-xl shadow-indigo/20 disabled:opacity-50 cursor-pointer"
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
    const [isPendingClaim, setIsPendingClaim] = useState(false);
    const { user, refetchUser } = useAuth();
    const [showTrustScreen, setShowTrustScreen] = useState(user ? !user.has_completed_payment : false);
    const [trustSaving, setTrustSaving] = useState(false);
    const initRef = useRef(false);

    const acceptTrustScreen = async () => {
        setTrustSaving(true);
        try {
            await authApi.updateMe({ has_completed_payment: true });
            await refetchUser();
            setShowTrustScreen(false);
        } catch (err) {
            console.error("Failed to update trust flag", err);
            setShowTrustScreen(false); // dismiss anyway to let them pay
        }
    };

    // Fetch a FRESH client_secret every time the modal mounts
    useEffect(() => {
        // Strict: only run once per mount, and wait until trust screen is dismissed
        if (initRef.current || showTrustScreen) return;
        initRef.current = true;

        const initPayment = async () => {
            console.log(`[StripePayment] Initializing payment: payee=${payeeId} amount=${amount} settlement=${settlementId}`);
            try {
                const res = await paymentsApi.create({
                    payee_id: payeeId,
                    amount: Math.round(amount * 100),
                    settlement_id: settlementId,
                });
                
                console.log(`[StripePayment] Payment API response: status=${res.status} payment_id=${res.payment_id} secret=${res.client_secret?.slice(0, 20)}...`);

                if (res.status === 'already_completed') {
                    onSuccess();
                    onClose();
                    return;
                }

                if (res.status === 'pending_claim') {
                    setIsPendingClaim(true);
                    setLoading(false);
                    return;
                }

                if (!res.client_secret) {
                    console.error('[StripePayment] No client_secret returned from API!');
                    setError('Payment initialization failed — no secret returned. The payment may already be processing.');
                    setLoading(false);
                    return;
                }

                setClientSecret(res.client_secret);
                setPaymentId(res.payment_id);
            } catch (err: any) {
                console.error('[StripePayment] initPayment error:', err);
                setError(err.message || 'Payment initialization failed.');
            } finally {
                setLoading(false);
            }
        };

        if (payeeId && amount > 0) {
            initPayment();
        } else {
            setError('Invalid payment parameters.');
            setLoading(false);
        }
    }, [showTrustScreen]); // Re-run when trust screen is dismissed

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-bg border border-border w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl relative">
                
                {showTrustScreen ? (
                    <div className="p-8 text-center relative z-10">
                        <div className="w-16 h-16 bg-accent/10 border border-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                            <Lock className="w-8 h-8 text-accent" />
                        </div>
                        <h2 className="text-2xl font-black text-primary mb-3">Safe & Secure</h2>
                        <p className="text-sm text-secondary mb-6 leading-relaxed">
                            TandemPay uses <strong className="text-primary">Stripe</strong> to process payments. We never see, store, or transmit your card numbers or bank details. 
                            Everything is 100% encrypted end-to-end.
                        </p>
                        
                        <div className="bg-surface border border-border rounded-xl p-4 mb-8 flex items-center gap-4 text-left">
                            <ShieldCheck className="w-6 h-6 text-indigo shrink-0" />
                            <div>
                                <p className="text-sm font-bold text-primary">Bank-Grade Encryption</p>
                                <p className="text-xs text-secondary mt-0.5">Your money moves securely.</p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                disabled={trustSaving}
                                className="flex-1 py-4 bg-surface hover:bg-border text-primary font-bold rounded-2xl transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={acceptTrustScreen}
                                disabled={trustSaving}
                                className="flex-[2] py-4 bg-accent hover:bg-accent/90 text-bg font-bold rounded-2xl shadow-xl shadow-accent/20 transition-all flex justify-center items-center gap-2 cursor-pointer"
                            >
                                {trustSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Continue to Payment'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between p-7 border-b border-border bg-surface/30">
                    <div>
                        <h2 className="text-2xl font-black text-primary tracking-tight">Secure Payment</h2>
                        <div className="flex items-center gap-1.5 mt-1 bg-accent/10 px-2 py-0.5 rounded-full w-fit">
                            <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                            <span className="text-[10px] uppercase font-bold text-accent tracking-wider">Processed by Stripe</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 bg-surface hover:bg-border rounded-2xl transition-all cursor-pointer">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-8">
                    {loading ? (
                        <div className="py-16 text-center">
                            <Loader2 className="w-12 h-12 text-indigo animate-spin mx-auto mb-6" />
                            <p className="text-secondary font-bold animate-pulse">Establishing Secure Tunnel...</p>
                        </div>
                    ) : isPendingClaim ? (
                        <div className="py-8 text-center animate-in fade-in zoom-in duration-500">
                            <div className="w-20 h-20 bg-indigo/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CheckCircle2 className="w-10 h-10 text-indigo" />
                            </div>
                            <h3 className="text-2xl font-bold text-primary mb-2">Notification Sent</h3>
                            <p className="text-sm text-secondary mb-8">
                                This user hasn't connected their bank account yet. We've notified them to set it up so you can pay them. We'll let you know when they're ready!
                            </p>
                            <button onClick={() => { onSuccess(); onClose(); }} className="w-full py-4 bg-indigo hover:bg-indigo-hover text-white font-bold rounded-2xl cursor-pointer">Got it</button>
                        </div>
                    ) : error ? (
                        <div className="py-8 text-center">
                            <div className="w-16 h-16 bg-danger/10 rounded-full flex items-center justify-center mx-auto mb-6 text-danger">
                                <X className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-bold text-primary mb-2">Initialization Failed</h3>
                            <p className="text-sm text-secondary mb-8">{error}</p>
                            <button onClick={onClose} className="w-full py-4 bg-primary text-bg font-bold rounded-2xl cursor-pointer">Return</button>
                        </div>
                    ) : clientSecret && paymentId ? (
                        <Elements 
                            key={clientSecret}
                            stripe={stripePromise} 
                            options={{ 
                                clientSecret, 
                                appearance: { 
                                    theme: 'night', 
                                    variables: { colorPrimary: '#3ECF8E' } 
                                } 
                            }}
                        >
                            <CheckoutForm 
                                amount={amount} 
                                paymentId={paymentId}
                                clientSecret={clientSecret}
                                onSuccess={() => { onSuccess(); onClose(); }} 
                                onCancel={onClose} 
                            />
                        </Elements>
                    ) : (
                        <div className="py-8 text-center">
                            <div className="w-16 h-16 bg-danger/10 rounded-full flex items-center justify-center mx-auto mb-6 text-danger">
                                <AlertTriangle className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-bold text-primary mb-2">Something Went Wrong</h3>
                            <p className="text-sm text-secondary mb-8">Could not initialize payment session.</p>
                            <button onClick={onClose} className="w-full py-4 bg-primary text-bg font-bold rounded-2xl cursor-pointer">Return</button>
                        </div>
                    )}
                </div>
                </>
                )}
            </div>
        </div>
    );
}
