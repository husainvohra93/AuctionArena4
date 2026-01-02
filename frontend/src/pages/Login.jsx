import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import axios from 'axios';
import { Trophy, Users, Gavel } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Login = () => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check if already authenticated
    const checkAuth = async () => {
      try {
        const response = await axios.get(`${API}/auth/me`, { withCredentials: true });
        const user = response.data;
        if (user.role === 'admin') {
          navigate('/admin', { replace: true });
        } else {
          navigate('/team', { replace: true });
        }
      } catch {
        setChecking(false);
      }
    };
    checkAuth();
  }, [navigate]);

  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const handleLogin = () => {
    //const redirectUrl = window.location.origin + '/admin';
    const redirectUrl = window.location.origin + '/';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen hero-gradient relative overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{ 
          backgroundImage: 'url(https://images.unsplash.com/photo-1750716413756-b66624b64ce4?crop=entropy&cs=srgb&fm=jpg&q=85)'
        }}
      />
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/60 to-slate-950" />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
        {/* Logo/Title */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Trophy className="w-12 h-12 text-blue-500" />
          </div>
          <h1 className="font-heading text-5xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight mb-4">
            AUCTION<span className="text-blue-500">ARENA</span>
          </h1>
          <p className="text-slate-400 text-lg sm:text-xl max-w-md mx-auto">
            The Ultimate Player Auction Platform for Cricket Tournaments
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12 max-w-3xl mx-auto">
          <div className="glass-card p-6 text-center">
            <Users className="w-8 h-8 text-blue-400 mx-auto mb-3" />
            <h3 className="font-heading font-bold text-white mb-1">20 Teams</h3>
            <p className="text-slate-500 text-sm">Manage up to 20 teams</p>
          </div>
          <div className="glass-card p-6 text-center">
            <Gavel className="w-8 h-8 text-green-400 mx-auto mb-3" />
            <h3 className="font-heading font-bold text-white mb-1">Live Bidding</h3>
            <p className="text-slate-500 text-sm">Real-time auction updates</p>
          </div>
          <div className="glass-card p-6 text-center">
            <Trophy className="w-8 h-8 text-yellow-400 mx-auto mb-3" />
            <h3 className="font-heading font-bold text-white mb-1">Fair Play</h3>
            <p className="text-slate-500 text-sm">Transparent player selection</p>
          </div>
        </div>

        {/* Login Button */}
        <Button
          data-testid="google-login-btn"
          onClick={handleLogin}
          className="bg-white hover:bg-slate-100 text-slate-900 font-bold py-6 px-10 rounded-xl text-lg shadow-lg transition-all hover:scale-105 flex items-center gap-3"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </Button>

        <p className="text-slate-600 text-sm mt-6">
          Admin & Team Owner access via Google Authentication
        </p>
      </div>
    </div>
  );
};

export default Login;
