import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import GroupPage from './pages/GroupPage';
import InvitePage from './pages/InvitePage';
import PaymentsPage from './pages/PaymentsPage';
import FriendsPage from './pages/FriendsPage';
import LandingPage from './pages/LandingPage';
import Layout from './components/Layout';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-bg">
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    // If not logged in, redirect to register but remember where they wanted to go
    const location = window.location;
    const returnTo = location.pathname !== '/dashboard' ? `?returnTo=${encodeURIComponent(location.pathname)}` : '';

    return user ? <>{children}</> : <Navigate to={`/register${returnTo}`} />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-bg">
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }
    return user ? <Navigate to="/dashboard" /> : <>{children}</>;
}

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/" element={<PublicRoute><LandingPage /></PublicRoute>} />
                    <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
                    <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
                    <Route path="/dashboard" element={<ProtectedRoute><Layout><DashboardPage /></Layout></ProtectedRoute>} />
                    <Route path="/payments" element={<ProtectedRoute><Layout><PaymentsPage /></Layout></ProtectedRoute>} />
                    <Route path="/friends" element={<ProtectedRoute><Layout><FriendsPage /></Layout></ProtectedRoute>} />
                    <Route path="/groups/:groupId" element={<ProtectedRoute><Layout><GroupPage /></Layout></ProtectedRoute>} />
                    <Route path="/invite/:groupId" element={<ProtectedRoute><InvitePage /></ProtectedRoute>} />
                    <Route path="*" element={<Navigate to="/dashboard" />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}
