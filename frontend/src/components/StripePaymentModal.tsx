import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { X, Loader2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { paymentsApi, stripeApi } from '../services/api';
import { formatCurrency } from '../utils/currency';

// Stripe public key - ideally loaded from env
const stripePromise = loadStripe((import.meta.env.VITE_STRIPE_PUBLIC_KEY as string) || 'pk_test_TYooMQauvdEDq54NiTphI7jx');

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
    const [isPaying, setIsPaying] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [step, setStep] = useState<'form' | 'processing' | 'success' | 'stuck'>('form');

    const startPolling = async () => {
        let attempts = 0;
        const maxAttempts = 12; // 60 seconds (12 * 5s)
        
        const interval = setInterval(async () => {
            attempts++;
            try {
                const res = await paymentsApi.reconcile(paymentId);
                if (res.status === 'succeeded') {
                    clearInterval(interval);
                    setStep('success');
                    setTimeout(onSuccess, 1500);
                } else if (res.status === 'failed') {
                    clearInterval(interval);
                    setErrorMessage("Payment failed. Please try again.");
                    setStep('form');
                    setIsPaying(false);
                }
            } catch (err) {
                console.error("Polling error:", err);
            }

            if (attempts >= maxAttempts) {
                clearInterval(interval);
                setStep('stuck');
            }
        }, 5000);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!stripe || !elements || isPaying) return;

        setIsPaying(true);
        setErrorMessage(null);

        // 1. Submit the form to Stripe first (validates inputs)
        const { error: submitError } = await elements.submit();
        if (submitError) {
            setErrorMessage(submitError.message || "Please check your card details.");
            setIsPaying(false);
            return;
        }

        // 2. Confirm the payment
        const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: window.location.href,
            },
            redirect: "if_required",
        });

        if (error) {
            setErrorMessage(error.message || "An unexpected error occurred.");
            setIsPaying(false);
        } else if (paymentIntent) {
            // 3. Strict status machine
            switch (paymentIntent.status) {
                case "succeeded":
                    setStep('success');
                    setTimeout(onSuccess, 1500);
                    break;
                case "processing":
                    setStep('processing');
                    startPolling();
                    break;
                case "requires_action":
                    // Stripe will handle the redirect/popup automatically
                    break;
                case "requires_payment_method":
                    setErrorMessage("Payment failed. Please try another card.");
                    setIsPaying(false);
                    break;
                default:
                    setStep('processing');
                    startPolling();
            }
        }
    };

    if (step === 'success') {
        return (
            <div className="py-8 text-center animate-in fade-in zoom-in duration-300">
                <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-accent" />
                </div>
                <h3 className="text-xl font-bold text-primary mb-2">Payment Successful!</h3>
                <p className="text-sm text-secondary">Your payment is processing and will arrive shortly.</p>
            </div>
        );
    }

    if (step === 'processing') {
        return (
            <div className="py-12 text-center animate-in fade-in zoom-in">
                <Loader2 className="w-10 h-10 text-indigo animate-spin mx-auto mb-4" />
                <h3 className="text-lg font-bold text-primary mb-1">Confirming Payment...</h3>
                <p className="text-sm text-secondary">We're verifying the transaction with your bank. This usually takes a few seconds.</p>
            </div>
        );
    }

    if (step === 'stuck') {
        return (
            <div className="py-8 text-center animate-in fade-in zoom-in">
                <div className="w-16 h-16 bg-warning/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Loader2 className="w-8 h-8 text-warning animate-pulse" />
                </div>
                <h3 className="text-lg font-bold text-primary mb-2">Still Processing...</h3>
                <p className="text-sm text-secondary mb-6">
                    We're still waiting for confirmation from the payment provider. 
                    It's safe to close this; the status will update in your dashboard shortly.
                </p>
                <div className="flex flex-col gap-2">
                    <button
                        onClick={() => { setStep('processing'); startPolling(); }}
                        className="w-full py-3 bg-indigo text-white font-bold rounded-xl"
                    >
                        Re-check Status
                    </button>
                    <button
                        onClick={onCancel}
                        className="w-full py-3 bg-surface text-primary font-bold rounded-xl"
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <PaymentElement className="mb-4" />
            
            {errorMessage && (
                <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-sm font-medium text-danger animate-in fade-in">
                    {errorMessage}
                </div>
            )}

            <div className="flex items-center gap-3 pt-2">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isPaying}
                    className="flex-1 py-3 px-4 bg-surface hover:bg-border text-primary font-bold rounded-xl transition-colors disabled:opacity-50"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={!stripe || isPaying}
                    className="flex-1 py-3 px-4 bg-indigo hover:bg-indigo-hover text-white font-bold rounded-xl flex items-center justify-center transition-colors shadow-lg shadow-indigo/20 disabled:opacity-50"
                >
                    {isPaying ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        `Pay $${formatCurrency(amount)}`
                    )}
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

    useEffect(() => {
        const initPayment = async () => {
            try {
                const res = await paymentsApi.create({
                    payee_id: payeeId,
                    amount: Math.round(amount * 100), // Convert to cents
                    settlement_id: settlementId,
                });
                setClientSecret(res.client_secret);
                setPaymentId(res.payment_id);
            } catch (err: any) {
                setError(err.message || 'Failed to initialize payment');
            } finally {
                setLoading(false);
            }
        };

        if (payeeId && amount > 0) {
            initPayment();
        }
    }, [payeeId, amount, settlementId]);

    // Added: Redirect Recovery
    // We move the redirect check into a sub-component that is wrapped in <Elements>
    const RedirectHandler = () => {
        const stripe = useStripe();
        useEffect(() => {
            if (!stripe) return;
            const clientSecretURL = new URLSearchParams(window.location.search).get("payment_intent_client_secret");
            if (clientSecretURL) {
                stripe.retrievePaymentIntent(clientSecretURL).then(({paymentIntent}) => {
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-bg border border-border w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-5 border-b border-border bg-surface/50">
                    <div>
                        <h2 className="text-xl font-bold text-primary">Complete Payment</h2>
                        <div className="flex items-center gap-1.5 mt-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                            <span className="text-xs font-medium text-secondary">Secured by Stripe</span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl text-secondary hover:text-primary hover:bg-border transition-colors focus:outline-none"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 text-indigo animate-spin mb-4" />
                            <p className="text-sm text-secondary font-medium animate-pulse">Initializing secure connection...</p>
                        </div>
                    ) : error ? (
                        <div className="text-center py-8">
                            <div className="w-12 h-12 bg-danger/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                                <X className="w-6 h-6 text-danger" />
                            </div>
                            <h3 className="text-lg font-bold text-primary mb-2">Payment Error</h3>
                            <p className="text-sm text-secondary mb-6">{error}</p>
                            <button
                                onClick={onClose}
                                className="px-6 py-2 bg-surface hover:bg-border text-primary font-bold rounded-xl transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    ) : clientSecret && (
                        <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night' } }}>
                            <RedirectHandler />
                            <CheckoutForm 
                                amount={amount} 
                                paymentId={paymentId || ''}
                                onSuccess={() => {
                                    onSuccess();
                                    onClose();
                                }} 
                                onCancel={onClose} 
                            />
                        </Elements>
                    )}
                </div>
            </div>
        </div>
    );
}
