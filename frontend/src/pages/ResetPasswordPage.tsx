import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Wallet, Lock, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { authApi } from '../services/api';

export default function ResetPasswordPage() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (!token) {
            setErrorMsg('Invalid or missing password reset token.');
        }
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) return;

        if (password !== confirmPassword) {
            setErrorMsg("Passwords do not match");
            return;
        }

        setLoading(true);
        setErrorMsg('');

        try {
            await authApi.resetPassword(token, password);
            setSubmitted(true);
        } catch (error: any) {
            console.error('Password reset failed:', error);
            const msg = error.message || 'Failed to reset password. The link might have expired.';
            setErrorMsg(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-bg flex items-center justify-center p-4">
            {/* Background glow effects */}
            <div className="fixed top-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
            <div className="fixed bottom-0 left-1/4 w-96 h-96 bg-indigo/5 rounded-full blur-3xl pointer-events-none" />

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
                                <h1 className="text-xl font-bold text-primary mb-1">Set new password</h1>
                                <p className="text-sm text-secondary">Please enter your new password below.</p>
                            </div>

                            {errorMsg && (
                                <div className="p-3 mb-4 text-sm text-danger bg-danger/10 border border-danger/20 rounded-xl">
                                    {errorMsg}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-secondary mb-2">New Password</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <Lock className="h-4 w-4 text-secondary/60" />
                                        </div>
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="••••••••"
                                            required
                                            minLength={6}
                                            disabled={!token}
                                            className="w-full bg-bg border border-border rounded-xl pl-11 pr-4 py-3 text-sm text-primary placeholder-secondary/50 focus:outline-none focus:border-accent transition-colors"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-secondary mb-2">Confirm Password</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <Lock className="h-4 w-4 text-secondary/60" />
                                        </div>
                                        <input
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="••••••••"
                                            required
                                            minLength={6}
                                            disabled={!token}
                                            className="w-full bg-bg border border-border rounded-xl pl-11 pr-4 py-3 text-sm text-primary placeholder-secondary/50 focus:outline-none focus:border-accent transition-colors"
                                        />
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading || !password || !confirmPassword || !token}
                                    className="w-full bg-accent hover:bg-accent-hover text-white font-semibold py-3 rounded-xl transition-all duration-200 disabled:opacity-50 mt-2 cursor-pointer"
                                >
                                    {loading ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Resetting...
                                        </div>
                                    ) : (
                                        'Reset Password'
                                    )}
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="text-center py-4">
                            <div className="w-16 h-16 bg-accent/10 border border-accent/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CheckCircle2 className="w-8 h-8 text-accent" />
                            </div>
                            <h2 className="text-xl font-bold text-primary mb-2">Password reset!</h2>
                            <p className="text-sm text-secondary mb-8">
                                Your new password has been set. You can now use it to log in.
                            </p>
                            <Link
                                to="/login"
                                className="w-full bg-bg hover:bg-surface-hover border border-border text-primary font-semibold py-3 rounded-xl transition-all duration-200 block"
                            >
                                Continue to Log in
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
