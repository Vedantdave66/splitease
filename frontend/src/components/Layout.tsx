import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, LogOut, Wallet, Menu, X, Users, Activity } from 'lucide-react';
import Avatar from './Avatar';
import NotificationBell from './NotificationBell';
import ThemeToggle from './ThemeToggle';

export default function Layout({ children }: { children: React.ReactNode }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-bg flex flex-col md:flex-row">
            {/* Mobile Header */}
            <header className="md:hidden bg-surface border-b border-border p-4 flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
                        <Wallet className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-lg font-bold text-primary">Tandem</span>
                </div>
                <div className="flex items-center gap-2">
                    <ThemeToggle />
                    <NotificationBell />
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="p-2 text-secondary hover:text-primary hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
                        aria-label="Open menu"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                </div>
            </header>

            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 md:hidden transition-opacity"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed inset-y-0 left-0 z-40 w-64 bg-surface border-r border-border flex flex-col h-full
                transform transition-transform duration-300 ease-in-out
                md:translate-x-0
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                {/* Logo */}
                <div className="p-6 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-accent rounded-lg flex items-center justify-center">
                            <Wallet className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-lg font-bold text-primary">Tandem</span>
                    </div>
                    <button
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="md:hidden p-2 text-secondary hover:text-primary hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
                        aria-label="Close menu"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Nav */}
                <nav className="flex-1 p-4 space-y-2">
                    <button
                        onClick={() => {
                            navigate('/dashboard');
                            setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${location.pathname === '/dashboard'
                            ? 'bg-accent/10 text-accent font-bold'
                            : 'text-secondary hover:text-primary hover:bg-surface-hover'
                            }`}
                    >
                        <LayoutDashboard className="w-5 h-5" />
                        Dashboard
                    </button>
                    <button
                        onClick={() => {
                            navigate('/payments');
                            setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${location.pathname === '/payments'
                            ? 'bg-indigo/10 text-indigo font-bold'
                            : 'text-secondary hover:text-primary hover:bg-surface-hover'
                            }`}
                    >
                        <Wallet className="w-5 h-5" />
                        Payments
                    </button>
                    <button
                        onClick={() => {
                            navigate('/friends');
                            setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${location.pathname === '/friends' && !location.search.includes('tab=activity')
                            ? 'bg-warning/10 text-warning font-bold'
                            : 'text-secondary hover:text-primary hover:bg-surface-hover'
                            }`}
                    >
                        <Users className="w-5 h-5" />
                        Friends
                    </button>
                    <button
                        onClick={() => {
                            navigate('/friends?tab=activity');
                            setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${location.pathname === '/friends' && location.search.includes('tab=activity')
                            ? 'bg-accent/10 text-accent font-bold'
                            : 'text-secondary hover:text-primary hover:bg-surface-hover'
                            }`}
                    >
                        <Activity className="w-5 h-5" />
                        Activity
                    </button>
                </nav>

                {/* Notification Bell & Theme Desktop */}
                <div className="hidden md:flex flex-col gap-3 px-4 pb-4 border-b border-border mb-2">
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-secondary">Theme</span>
                        <ThemeToggle />
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-secondary">Notifications</span>
                        <NotificationBell />
                    </div>
                </div>

                {/* User */}
                <div className="p-4 border-t border-border">
                    <div className="flex items-center gap-3 mb-3 px-2">
                        {user && <Avatar name={user.name} color={user.avatar_color} size="sm" />}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-primary truncate">{user?.name}</p>
                            <p className="text-xs text-secondary truncate">{user?.email}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-secondary hover:text-danger hover:bg-danger/10 transition-all duration-200 cursor-pointer"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign out
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 md:ml-64 p-4 sm:p-6 md:p-8 w-full max-w-full min-h-[calc(100vh-73px)] md:min-h-screen">
                {children}
            </main>
        </div>
    );
}
