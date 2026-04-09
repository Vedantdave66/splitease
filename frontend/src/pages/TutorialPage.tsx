import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, ArrowLeft, Users, Receipt, TrendingUp, Bell, CreditCard, Send } from 'lucide-react';
import AuthBackground from '../components/AuthBackground';
import ThemeToggle from '../components/ThemeToggle';

const steps = [
    {
        id: 'groups',
        title: 'Create Groups & Add Friends',
        description: 'Start by creating a group for your trip, apartment, or night out. Invite friends via their email so everyone can collaborate.',
        icon: Users,
        color: 'text-indigo-400',
        bg: 'bg-indigo-500/20',
        content: (
            <div className="bg-surface border border-border rounded-xl p-5 shadow-lg relative group overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-[80px]" />
                <div className="flex items-center gap-3 mb-4 border-b border-border pb-4 relative z-10">
                    <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                        <Users className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div>
                        <div className="text-primary font-bold text-sm">Miami Trip 🌴</div>
                        <div className="text-xs text-secondary">4 members</div>
                    </div>
                </div>
                <div className="flex -space-x-2 relative z-10">
                    {[1,2,3,4].map(i => (
                        <div key={i} className="w-8 h-8 rounded-full bg-surface-light border-2 border-surface flex items-center justify-center text-xs text-secondary font-bold">
                            U{i}
                        </div>
                    ))}
                    <div className="w-8 h-8 rounded-full bg-accent text-white border-2 border-surface flex items-center justify-center text-xs font-bold shrink-0 shadow-[0_0_10px_rgba(52,211,153,0.3)]">
                        +
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 'expenses',
        title: 'Log Shared Expenses',
        description: 'Who paid for what? Add expenses quickly and choose how to split them: equally or by exact amounts per person.',
        icon: Receipt,
        color: 'text-yellow-400',
        bg: 'bg-yellow-500/20',
        content: (
            <div className="bg-surface border border-border rounded-xl p-5 shadow-lg relative overflow-hidden">
                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-yellow-500/10 rounded-full blur-[80px]" />
                <div className="flex justify-between items-start mb-4 relative z-10">
                    <div>
                        <div className="text-primary font-bold text-sm">Dinner at Carbone</div>
                        <div className="text-xs text-secondary">Paid by You</div>
                    </div>
                    <span className="text-primary font-bold">$240.00</span>
                </div>
                <div className="space-y-2 relative z-10">
                    <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-primary/5 rounded-full overflow-hidden flex border border-border">
                            <div className="w-1/4 bg-yellow-400 border-r border-surface"></div>
                            <div className="w-1/4 bg-yellow-400 border-r border-surface"></div>
                            <div className="w-1/4 bg-yellow-400 border-r border-surface"></div>
                            <div className="w-1/4 bg-yellow-400"></div>
                        </div>
                    </div>
                    <div className="text-[10px] text-secondary uppercase tracking-widest text-center mt-2 font-medium">Split equally</div>
                </div>
            </div>
        )
    },
    {
        id: 'balances',
        title: 'Smart Balances',
        description: 'Tandem calculates debts automatically. Instead of a messy web of who-owes-who, we show you the minimum transactions needed.',
        icon: TrendingUp,
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/20',
        content: (
             <div className="bg-surface border border-border rounded-xl p-5 shadow-lg relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-emerald-500/5 rounded-full blur-[60px]" />
                <div className="text-xs font-bold text-secondary uppercase tracking-widest mb-4 relative z-10">Suggested Settlements</div>
                <div className="flex items-center justify-between p-3 bg-bg rounded-lg mb-2 border border-border relative z-10">
                    <span className="text-sm text-primary">Dave <span className="text-secondary px-1">→</span> You</span>
                    <span className="text-accent font-bold text-sm">$45.00</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-bg rounded-lg border border-border relative z-10">
                    <span className="text-sm text-primary">You <span className="text-secondary px-1">→</span> Sarah</span>
                    <span className="text-danger font-bold text-sm">$12.50</span>
                </div>
            </div>
        )
    },
    {
        id: 'reminders',
        title: 'Automated Reminders',
        description: 'Tired of asking for money back? Set a recurring reminder on an expense, and Tandem will notify them automatically.',
        icon: Bell,
        color: 'text-amber-400',
        bg: 'bg-amber-500/20',
        content: (
            <div className="bg-surface border border-border rounded-xl p-5 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-xl" />
                <div className="flex items-center gap-3 mb-2 relative z-10">
                    <Bell className="w-4 h-4 text-amber-500" />
                    <span className="text-amber-500 font-bold text-sm">Active Reminder</span>
                </div>
                <div className="text-xs text-secondary relative z-10 mb-4 font-medium">Notifying participants every 3 days.</div>
                <div className="w-full h-8 rounded-lg border border-border bg-bg flex items-center justify-center text-xs text-primary font-medium shadow-inner">
                    Next: Tomorrow at 2 PM
                </div>
            </div>
        )
    },
    {
        id: 'bank',
        title: 'Connect with Stripe',
        description: 'Securely link your bank account via Stripe Connect. We use bank-level encryption to help you receive money quickly.',
        icon: CreditCard,
        color: 'text-indigo-500',
        bg: 'bg-indigo-500/20',
        content: (
             <div className="bg-surface border border-border rounded-xl p-6 shadow-2xl relative overflow-hidden">
                <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl" />
                <div className="text-center relative z-10">
                    <div className="w-16 h-16 bg-bg border border-border rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                        <CreditCard className="w-8 h-8 text-primary" />
                    </div>
                    <div className="text-lg font-bold text-primary mb-1">Receive Payments</div>
                    <div className="text-xs text-secondary mb-6 px-4">Tandem uses Stripe Connect to securely route money to your account.</div>
                    <button className="w-full py-2.5 rounded-xl bg-primary text-bg font-bold shadow-lg hover:shadow-xl hover:opacity-90 transition-all">
                        Connect with Stripe
                    </button>
                </div>
             </div>
        )
    },
    {
        id: 'settle',
        title: 'Pay Through App',
        description: 'No more switching apps or copy-pasting emails. Pay your friends directly within Tandem and instantly mark balances as settled.',
        icon: Send,
        color: 'text-emerald-500',
        bg: 'bg-emerald-500/20',
        content: (
             <div className="bg-surface border border-border rounded-xl p-6 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl" />
                <div className="text-center relative z-10 mb-6">
                    <div className="text-xs text-secondary mb-1 font-medium">Sending to Jane Doe</div>
                    <div className="text-3xl font-black text-primary">$75.50</div>
                </div>
                <div className="flex items-center justify-between p-3 bg-bg rounded-xl border border-border mb-4 relative z-10">
                    <div className="flex items-center gap-2">
                         <div className="w-8 h-8 bg-surface-light rounded-lg flex items-center justify-center border border-border">
                             <CreditCard className="w-4 h-4 text-primary" />
                         </div>
                         <div className="text-sm font-medium text-primary">Chase Checking •••• 1234</div>
                    </div>
                </div>
                <button className="w-full py-3 rounded-xl bg-accent text-white font-bold shadow-[0_0_15px_rgba(52,211,153,0.3)] hover:shadow-[0_0_25px_rgba(52,211,153,0.5)] transition-all relative z-10">
                    Pay Now
                </button>
             </div>
        )
    }
];

export default function TutorialPage() {
    const [activeStep, setActiveStep] = useState(0);

    // Auto-advance logic for demonstration
    useEffect(() => {
        const interval = setInterval(() => {
            setActiveStep((prev) => (prev + 1) % steps.length);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="min-h-screen bg-bg relative overflow-hidden transition-colors duration-500">
            <AuthBackground />
            
            {/* Header */}
            <div className="relative z-10 border-b border-border bg-bg/80 backdrop-blur-xl transition-colors duration-500">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2 text-secondary hover:text-primary transition-colors font-medium">
                        <ArrowLeft className="w-4 h-4" />
                        <span className="hidden sm:inline">Back to Home</span>
                    </Link>
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-accent to-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-accent/20">
                                <Wallet className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-bold text-primary hidden sm:block">Tandem</span>
                        </div>
                        <ThemeToggle />
                    </div>
                </div>
            </div>

            <main className="relative z-10 max-w-5xl mx-auto px-6 py-16 md:py-24">
                <div className="text-center mb-16 auth-entrance" style={{ animationDelay: '0ms' }}>
                    <h1 className="text-4xl md:text-5xl font-black text-primary tracking-tight mb-4 transition-colors duration-500">How it works</h1>
                    <p className="text-lg text-secondary max-w-xl mx-auto transition-colors duration-500">Master Tandem in just moving steps. No more spreadsheets, no more stress.</p>
                </div>

                <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
                    {/* Left: Interactions */}
                    <div className="auth-entrance bg-surface border border-border rounded-3xl p-6 md:p-10 shadow-2xl relative" style={{ animationDelay: '100ms' }}>
                         {/* Dynamic Glow matching active step */}
                        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-[100px] pointer-events-none transition-colors duration-1000 ${steps[activeStep].bg.replace('/20', '/10')}`} />
                        
                        <div className="relative z-10 h-[300px] flex items-center justify-center perspective-1000">
                             {steps.map((step, idx) => (
                                 <div 
                                    key={step.id} 
                                    className={`absolute w-full max-w-sm transition-all duration-700 ease-out ${
                                        idx === activeStep 
                                            ? 'opacity-100 translate-y-0 scale-100' 
                                            : idx < activeStep 
                                                ? 'opacity-0 -translate-y-12 scale-95'
                                                : 'opacity-0 translate-y-12 scale-95'
                                    }`}
                                >
                                     {step.content}
                                 </div>
                             ))}
                        </div>
                    </div>

                    {/* Right: Step List */}
                    <div className="auth-entrance space-y-6" style={{ animationDelay: '200ms' }}>
                        {steps.map((step, idx) => {
                            const isActive = idx === activeStep;
                            const Icon = step.icon;
                            // Tweak opacity adjustment logic based on active state for light mode
                            const stepBgStyles = isActive ? 'bg-primary/5 border border-border shadow-md' : 'hover:bg-primary/[0.02] border border-transparent';
                            const stepIconBgStyles = isActive ? step.bg : 'bg-surface border border-border group-hover:border-primary/20';

                            return (
                                <div 
                                    key={step.id} 
                                    onClick={() => setActiveStep(idx)}
                                    className={`group flex gap-4 cursor-pointer p-4 rounded-2xl transition-all duration-300 ${stepBgStyles}`}
                                >
                                    <div className="shrink-0 mt-1">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-300 ${stepIconBgStyles}`}>
                                            <Icon className={`w-5 h-5 transition-colors duration-300 ${isActive ? step.color : 'text-secondary group-hover:text-primary/70'}`} />
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className={`text-lg font-bold mb-2 transition-colors duration-300 ${isActive ? 'text-primary' : 'text-secondary group-hover:text-primary/90'}`}>
                                            {idx + 1}. {step.title}
                                        </h3>
                                        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isActive ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                                            <p className="text-sm text-secondary leading-relaxed">
                                                {step.description}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        
                        <div className="pt-8">
                            <Link to="/register" className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-accent to-emerald-500 hover:from-accent-hover hover:to-emerald-600 text-white shadow-lg text-base font-bold transition-transform transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2">
                                Get Started Now
                            </Link>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

