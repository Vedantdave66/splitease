import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, LogOut, Wallet } from 'lucide-react';
import Avatar from './Avatar';

export default function Layout({ children }: { children: React.ReactNode }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-bg flex">
            {/* Sidebar */}
            <aside className="w-64 bg-surface border-r border-border flex flex-col fixed h-full">
                {/* Logo */}
                <div className="p-6 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-accent rounded-lg flex items-center justify-center">
                            <Wallet className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-lg font-bold text-primary">SplitEase</span>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 p-4 space-y-1">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${location.pathname === '/dashboard'
                                ? 'bg-accent/10 text-accent'
                                : 'text-secondary hover:text-primary hover:bg-surface-hover'
                            }`}
                    >
                        <LayoutDashboard className="w-5 h-5" />
                        Dashboard
                    </button>
                </nav>

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
            <main className="flex-1 ml-64 p-8">
                {children}
            </main>
        </div>
    );
}
