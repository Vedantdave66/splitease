import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Wallet, Eye, EyeOff } from 'lucide-react';

export default function RegisterPage() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [interacEmail, setInteracEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showColdStartWarning, setShowColdStartWarning] = useState(false);
    const { register } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // Clear warning when loading stops
    useEffect(() => {
        if (!loading) setShowColdStartWarning(false);
    }, [loading]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        setLoading(true);
        setError('');

        // Show warning if it takes longer than 5 seconds
        const warningTimer = setTimeout(() => {
            setShowColdStartWarning(true);
        }, 5000);

        try {
            await register(name, email, password, interacEmail || undefined);
            clearTimeout(warningTimer);
            const returnTo = searchParams.get('returnTo');
            navigate(returnTo || '/dashboard');
        } catch (err: any) {
            clearTimeout(warningTimer);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-bg flex items-center justify-center p-4">
            <div className="fixed top-0 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
            <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-accent/3 rounded-full blur-3xl pointer-events-none" />

            <div className="w-full max-w-sm relative">
                <div className="flex items-center justify-center gap-3 mb-10">
                    <div className="w-11 h-11 bg-accent rounded-xl flex items-center justify-center shadow-lg shadow-accent/20">
                        <Wallet className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-2xl font-bold text-primary">SplitEase</span>
                </div>

                <div className="bg-surface border border-border rounded-2xl p-8 shadow-2xl shadow-black/20">
                    <div className="mb-8">
                        <h1 className="text-xl font-bold text-primary mb-1">Create account</h1>
                        <p className="text-sm text-secondary">Start splitting expenses with friends</p>
                    </div>

                    {error && (
                        <div className="bg-danger/10 border border-danger/30 text-danger text-sm rounded-lg p-3 mb-5 animate-pulse">
                            {error}
                        </div>
                    )}

                    {showColdStartWarning && !error && (
                        <div className="bg-accent/10 border border-accent/30 text-accent text-sm rounded-lg p-3 mb-5">
                            <p className="font-semibold mb-1">Server is waking up 😴</p>
                            <p>Since we're using a free server tier, the database spins down when not in use. This first request might take up to 50 seconds to complete. Please hang tight!</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-2">Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Your name"
                                required
                                className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm text-primary placeholder-secondary/50 focus:outline-none focus:border-accent transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-2">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                required
                                className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm text-primary placeholder-secondary/50 focus:outline-none focus:border-accent transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-2">Interac e-Transfer Email <span className="text-secondary/50 font-normal">(Optional)</span></label>
                            <input
                                type="email"
                                value={interacEmail}
                                onChange={(e) => setInteracEmail(e.target.value)}
                                placeholder="For friends to pay you back"
                                className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm text-primary placeholder-secondary/50 focus:outline-none focus:border-accent transition-colors"
                            />
                            <p className="text-[11px] text-secondary/60 mt-1.5 ml-1">If provided, this is the email friends will see when settling debts via E-Transfer.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-2">Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className="w-full bg-bg border border-border rounded-xl px-4 py-3 pr-11 text-sm text-primary placeholder-secondary/50 focus:outline-none focus:border-accent transition-colors"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-primary transition-colors cursor-pointer"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-accent hover:bg-accent-hover text-white font-semibold py-3 rounded-xl transition-all duration-200 disabled:opacity-50 mt-2 cursor-pointer"
                        >
                            {loading ? (
                                <div className="flex items-center justify-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Creating account...
                                </div>
                            ) : (
                                'Create account'
                            )}
                        </button>
                    </form>
                </div>

                <p className="text-center text-sm text-secondary mt-6">
                    Already have an account?{' '}
                    <Link to={`/login${searchParams.toString() ? `?${searchParams.toString()}` : ''}`} className="text-accent hover:text-accent-hover font-medium transition-colors">
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    );
}
