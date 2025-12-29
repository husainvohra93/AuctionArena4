import React, { useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '@/App';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  LayoutDashboard, 
  Users, 
  UserCircle, 
  Gavel, 
  LogOut,
  Trophy,
  Radio
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Layout = ({ children }) => {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
      toast.success('Logged out successfully');
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
      navigate('/login', { replace: true });
    }
  };

  const adminLinks = [
    { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/admin/players', icon: UserCircle, label: 'Players' },
    { path: '/admin/teams', icon: Users, label: 'Teams' },
    { path: '/admin/auction', icon: Gavel, label: 'Auction Control' },
    { path: '/auction', icon: Radio, label: 'Live Auction' },
  ];

  const teamOwnerLinks = [
    { path: '/team', icon: LayoutDashboard, label: 'My Team' },
    { path: '/auction', icon: Radio, label: 'Live Auction' },
  ];

  const links = user?.role === 'admin' ? adminLinks : teamOwnerLinks;

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900/50 border-r border-slate-800 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-slate-800">
          <Link to={user?.role === 'admin' ? '/admin' : '/team'} className="flex items-center gap-2">
            <Trophy className="w-8 h-8 text-blue-500" />
            <span className="font-heading font-bold text-xl text-white">
              CRICKET<span className="text-blue-500">MART</span>
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {links.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              data-testid={`nav-${link.label.toLowerCase().replace(' ', '-')}`}
              className={`sidebar-link ${location.pathname === link.path ? 'active' : ''}`}
            >
              <link.icon className="w-5 h-5" />
              <span className="font-medium">{link.label}</span>
            </Link>
          ))}
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            {user?.picture ? (
              <img src={user.picture} alt={user.name} className="w-10 h-10 rounded-full" />
            ) : (
              <div className="avatar">
                <UserCircle className="w-6 h-6 text-slate-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 uppercase tracking-wider">
                {user?.role === 'admin' ? 'Admin' : 'Team Owner'}
              </p>
            </div>
          </div>
          <button
            data-testid="logout-btn"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-4 py-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
};

export default Layout;
