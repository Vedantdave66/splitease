import { Link } from 'react-router-dom';
import { Wallet, Shield, Zap, TrendingUp, Users, ArrowRight } from 'lucide-react';

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-[#09090B] selection:bg-accent/30 selection:text-white">
            {/* Ambient Background Glows */}
            <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

            {/* Navigation */}
            <nav className="relative z-10 border-b border-white/5 bg-[#09090B]/50 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3 relative group cursor-pointer">
                        <div className="absolute inset-0 bg-accent/20 rounded-xl blur-lg group-hover:bg-accent/30 transition-all duration-300" />
                        <div className="relative w-10 h-10 bg-gradient-to-br from-accent to-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-accent/20">
                            <Wallet className="w-5 h-5 text-[#064E3B]" />
                        </div>
                        <span className="relative text-xl font-bold tracking-tight text-white">SplitEase</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link
                            to="/login"
                            className="hidden sm:block px-5 py-2.5 text-sm font-medium text-white/70 hover:text-white transition-colors"
                        >
                            Log in
                        </Link>
                        <Link
                            to="/register"
                            className="px-5 py-2.5 rounded-xl bg-white text-black text-sm font-bold hover:bg-white/90 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-white/10"
                        >
                            Get Started
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <main className="relative z-10">
                <div className="max-w-7xl mx-auto px-6 pt-32 pb-24 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-semibold mb-8 backdrop-blur-md">
                        <SparklesIcon className="w-4 h-4" />
                        <span>The new standard for group expenses</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight mb-8 leading-[1.1]">
                        Split expenses. <br className="hidden md:block" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent via-emerald-400 to-indigo-400">
                            Settle debts instantly.
                        </span>
                    </h1>

                    <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-12 leading-relaxed">
                        Say goodbye to awkward money conversations. Track shared expenses, simplify group debts, and settle up with confidence using a modern, fast, and secure platform.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link
                            to="/register"
                            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-accent to-emerald-500 hover:from-accent-hover hover:to-emerald-600 text-[#064E3B] text-base font-bold transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_40px_-10px_rgba(52,211,153,0.5)] flex items-center justify-center gap-2"
                        >
                            Create Free Account
                            <ArrowRight className="w-5 h-5" />
                        </Link>
                        <Link
                            to="/login"
                            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-base font-bold transition-all flex items-center justify-center"
                        >
                            Sign In to continue
                        </Link>
                    </div>
                </div>

                {/* Features Grid */}
                <div className="max-w-7xl mx-auto px-6 py-24 border-t border-white/5">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Everything you need</h2>
                        <p className="text-white/50">Powerful features wrapped in a beautiful, premium design.</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                        <FeatureCard
                            icon={<Zap className="w-6 h-6 text-yellow-400" />}
                            title="Lightning Fast Logging"
                            description="Add an expense in seconds. Split it equally, by exact amounts, or by percentages."
                            glow="yellow-400"
                        />
                        <FeatureCard
                            icon={<TrendingUp className="w-6 h-6 text-accent" />}
                            title="Smart Debt Simplification"
                            description="We automatically calculate the minimum number of transactions needed to settle all debts."
                            glow="emerald-400"
                        />
                        <FeatureCard
                            icon={<Shield className="w-6 h-6 text-indigo-400" />}
                            title="Secure Reminders"
                            description="Gentle, automated notifications so you never have to ask for your money back."
                            glow="indigo-400"
                        />
                    </div>
                </div>

                {/* How it works simple visualization */}
                <div className="max-w-5xl mx-auto px-6 py-24 border-t border-white/5">
                    <div className="bg-[#0C0E14] border border-[#1E2230]/80 rounded-3xl p-8 md:p-12 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-96 h-96 bg-accent/5 rounded-full blur-[100px]" />

                        <div className="relative z-10 grid md:grid-cols-2 gap-12 items-center">
                            <div>
                                <h2 className="text-3xl font-bold text-white mb-6">Settle up your way</h2>
                                <p className="text-white/60 mb-8 leading-relaxed">
                                    When it's time to pay, simply click "Settle Up". Add your Interac e-Transfer email to let friends easily copy it and send you money directly from their banking app.
                                </p>
                                <ul className="space-y-4">
                                    <li className="flex items-center gap-3 text-sm text-white/80">
                                        <div className="w-6 h-6 flex items-center justify-center rounded-full bg-accent/20 text-accent font-bold">1</div>
                                        Track expenses in groups
                                    </li>
                                    <li className="flex items-center gap-3 text-sm text-white/80">
                                        <div className="w-6 h-6 flex items-center justify-center rounded-full bg-accent/20 text-accent font-bold">2</div>
                                        See who owes who instantly
                                    </li>
                                    <li className="flex items-center gap-3 text-sm text-white/80">
                                        <div className="w-6 h-6 flex items-center justify-center rounded-full bg-accent/20 text-accent font-bold">3</div>
                                        Mark as paid when settled
                                    </li>
                                </ul>
                            </div>

                            <div className="relative">
                                {/* Abstract UI Representation */}
                                <div className="bg-[#09090B] border border-white/10 rounded-2xl p-6 shadow-2xl transform rotate-2 hover:rotate-0 transition-transform duration-500">
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                                                <Users className="w-5 h-5 text-indigo-400" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-white">Trip to Banff</div>
                                                <div className="text-xs text-white/40">You owe $150.00</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="w-full h-12 rounded-xl bg-gradient-to-r from-accent to-emerald-500 flex items-center justify-center text-[#064E3B] font-bold text-sm shadow-[0_0_20px_rgba(52,211,153,0.3)]">
                                        Settle Up Now
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-white/5 py-12 text-center text-sm text-white/30 relative z-10">
                <p>© {new Date().getFullYear()} SplitEase. All rights reserved.</p>
            </footer>
        </div>
    );
}

function FeatureCard({ icon, title, description, glow }: { icon: React.ReactNode, title: string, description: string, glow: string }) {
    return (
        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 hover:bg-white/[0.04] transition-colors relative overflow-hidden group">
            {/* Hover Glow */}
            <div className={`absolute -top-24 -right-24 w-48 h-48 bg-${glow}/20 rounded-full blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 relative z-10">
                {icon}
            </div>
            <h3 className="text-xl font-bold text-white mb-3 relative z-10">{title}</h3>
            <p className="text-sm text-white/50 leading-relaxed relative z-10">{description}</p>
        </div>
    );
}

function SparklesIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="Mm12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
            <path d="M5 3v4" />
            <path d="M19 17v4" />
            <path d="M3 5h4" />
            <path d="M17 19h4" />
        </svg>
    );
}
