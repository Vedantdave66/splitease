import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { authApi } from '../services/api';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await authApi.forgotPassword(email);
            setSubmitted(true);
        } catch (error) {
            console.error('Password reset request failed:', error);
            // We usually proceed anyway to prevent email enumeration,
            // but log it just in case.
            setSubmitted(true);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-bg flex items-center justify-center p-4">
            {/* Background glow effects */}
            <div className="fixed top-0 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
            <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-accent/3 rounded-full blur-3xl pointer-events-none" />

            <div className="w-full max-w-sm relative">
                {/* Logo */}
                <div className="flex items-center justify-center gap-3 mb-10">
                    <div className="w-11 h-11 bg-accent rounded-xl flex items-center justify-center shadow-lg shadow-accent/20">
                        <Wallet className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-2xl font-bold text-primary">Tandem</span>
                </div>

                {/* Card */}
                <div className="bg-surface border border-border rounded-2xl p-8 shadow-2xl shadow-black/20">
                    {!submitted ? (
                        <>
                            <div className="mb-8">
                                <h1 className="text-xl font-bold text-primary mb-1">Reset password</h1>
                                <p className="text-sm text-secondary">Enter your email and we'll send you a link to reset your password.</p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-secondary mb-2">Email address</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <Mail className="h-4 w-4 text-secondary/60" />
                                        </div>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="you@example.com"
                                            required
                                            className="w-full bg-bg border border-border rounded-xl pl-11 pr-4 py-3 text-sm text-primary placeholder-secondary/50 focus:outline-none focus:border-accent transition-colors"
                                        />
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading || !email}
                                    className="w-full bg-accent hover:bg-accent-hover text-white font-semibold py-3 rounded-xl transition-all duration-200 disabled:opacity-50 mt-2 cursor-pointer"
                                >
                                    {loading ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Sending...
                                        </div>
                                    ) : (
                                        'Send reset link'
                                    )}
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="text-center py-4">
                            <div className="w-16 h-16 bg-accent/10 border border-accent/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CheckCircle2 className="w-8 h-8 text-accent" />
                            </div>
                            <h2 className="text-xl font-bold text-primary mb-2">Check your email</h2>
                            <p className="text-sm text-secondary mb-8">
                                We've sent a password reset link to <span className="font-semibold text-primary">{email}</span>.
                            </p>
                            <Link
                                to="/login"
                                className="w-full bg-bg hover:bg-surface-hover border border-border text-primary font-semibold py-3 rounded-xl transition-all duration-200 block"
                            >
                                Back to Log in
                            </Link>
                        </div>
                    )}
                </div>

                {!submitted && (
                    <div className="mt-6 text-center text-sm">
                        <Link to="/login" className="inline-flex items-center gap-2 text-secondary hover:text-primary transition-colors">
                            <ArrowLeft className="w-4 h-4" />
                            Back to log in
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
