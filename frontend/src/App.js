import { useEffect, useState, useRef } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { Toaster } from "@/components/ui/sonner";

// Pages
import Login from "@/pages/Login";
import AdminDashboard from "@/pages/AdminDashboard";
import PlayerManagement from "@/pages/PlayerManagement";
import TeamManagement from "@/pages/TeamManagement";
import AuctionControl from "@/pages/AuctionControl";
import LiveAuction from "@/pages/LiveAuction";
import TeamOwnerDashboard from "@/pages/TeamOwnerDashboard";
import TournamentManagement from "@/pages/TournamentManagement";
import AuctionManagement from "@/pages/AuctionManagement";
import AdminAuctionControl from "@/pages/AdminAuctionControl";
import AuctionViewScreen from "@/pages/AuctionViewScreen";
import UserManagement from "@/pages/UserManagement";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
export const AuthContext = React.createContext(null);

import React from 'react';

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      const hash = location.hash;
      const sessionIdMatch = hash.match(/session_id=([^&]+)/);
      
      if (sessionIdMatch) {
        const sessionId = sessionIdMatch[1];
        try {
          const response = await axios.post(
            `${API}/auth/session`,
            { session_id: sessionId },
            { withCredentials: true }
          );
          
          const user = response.data;
          
          // Navigate based on role
          if (user.role === 'admin') {
            navigate('/admin', { state: { user }, replace: true });
          } else {
            navigate('/team', { state: { user }, replace: true });
          }
        } catch (error) {
          console.error('Auth error:', error);
          navigate('/login', { replace: true });
        }
      } else {
        navigate('/login', { replace: true });
      }
    };

    processAuth();
  }, [location, navigate]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-white text-xl">Authenticating...</div>
    </div>
  );
};

// Protected Route Component
const ProtectedRoute = ({ children, requiredRole }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(location.state?.user ? true : null);
  const [user, setUser] = useState(location.state?.user || null);

  useEffect(() => {
    if (location.state?.user) {
      setUser(location.state.user);
      setIsAuthenticated(true);
      return;
    }

    const checkAuth = async () => {
      try {
        const response = await axios.get(`${API}/auth/me`, { withCredentials: true });
        setUser(response.data);
        setIsAuthenticated(true);
      } catch (error) {
        setIsAuthenticated(false);
        navigate('/login', { replace: true });
      }
    };

    checkAuth();
  }, [location.state, navigate]);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to={user?.role === 'admin' ? '/admin' : '/team'} replace />;
  }

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// App Router with session_id detection
function AppRouter() {
  const location = useLocation();

  // Check URL fragment for session_id SYNCHRONOUSLY during render
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      {/* Admin Routes */}
      <Route path="/admin" element={
        <ProtectedRoute requiredRole="admin">
          <AdminDashboard />
        </ProtectedRoute>
      } />
      <Route path="/admin/players" element={
        <ProtectedRoute requiredRole="admin">
          <PlayerManagement />
        </ProtectedRoute>
      } />
      <Route path="/admin/teams" element={
        <ProtectedRoute requiredRole="admin">
          <TeamManagement />
        </ProtectedRoute>
      } />
      <Route path="/admin/tournaments" element={
        <ProtectedRoute requiredRole="admin">
          <TournamentManagement />
        </ProtectedRoute>
      } />
      <Route path="/admin/tournaments/:tournamentId/auctions" element={
        <ProtectedRoute requiredRole="admin">
          <AuctionManagement />
        </ProtectedRoute>
      } />
      <Route path="/admin/auction/:auctionId/control" element={
        <ProtectedRoute requiredRole="admin">
          <AdminAuctionControl />
        </ProtectedRoute>
      } />
      <Route path="/admin/users" element={
        <ProtectedRoute requiredRole="admin">
          <UserManagement />
        </ProtectedRoute>
      } />
      {/* Legacy auction control route */}
      <Route path="/admin/auction" element={
        <ProtectedRoute requiredRole="admin">
          <AuctionControl />
        </ProtectedRoute>
      } />
      
      {/* Team Owner Routes */}
      <Route path="/team" element={
        <ProtectedRoute requiredRole="team_owner">
          <TeamOwnerDashboard />
        </ProtectedRoute>
      } />
      
      {/* Public View Screen (no auth required) */}
      <Route path="/auction/:auctionId/view" element={<AuctionViewScreen />} />
      
      {/* Live Auction - Both roles can access */}
      <Route path="/auction" element={
        <ProtectedRoute>
          <LiveAuction />
        </ProtectedRoute>
      } />
      
      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App noise-overlay">
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;
