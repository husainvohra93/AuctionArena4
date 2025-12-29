import React, { useState, useEffect, useContext } from 'react';
import Layout from '@/components/Layout';
import { AuthContext } from '@/App';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Trophy,
  Radio,
  AlertCircle,
  Download,
  FileSpreadsheet,
  FileText
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TeamOwnerDashboard = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [team, setTeam] = useState(null);
  const [squad, setSquad] = useState([]);
  const [auctionState, setAuctionState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchAuctionState, 3000);
    return () => clearInterval(interval);
  }, [user]);

  const fetchData = async () => {
    try {
      await Promise.all([
        fetchTeamData(),
        fetchAuctionState()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamData = async () => {
    if (!user?.team_id) return;
    
    try {
      const response = await axios.get(`${API}/teams/${user.team_id}/squad`, { withCredentials: true });
      setTeam(response.data.team);
      setSquad(response.data.players);
    } catch (error) {
      console.error('Error fetching team:', error);
    }
  };

  const fetchAuctionState = async () => {
    try {
      const response = await axios.get(`${API}/auction/state`, { withCredentials: true });
      setAuctionState(response.data);
    } catch (error) {
      console.error('Error fetching auction state:', error);
    }
  };

  const formatPrice = (price) => {
    if (price >= 10000000) return `${(price / 10000000).toFixed(2)} Cr Pts`;
    if (price >= 100000) return `${(price / 100000).toFixed(2)} L Pts`;
    return `${price?.toLocaleString()} Pts`;
  };

  const getRoleCount = (role) => {
    return squad.filter(p => p.role === role).length;
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="spinner"></div>
        </div>
      </Layout>
    );
  }

  if (!team) {
    return (
      <Layout>
        <div className="p-6 lg:p-8">
          <div className="container-main">
            <Card className="glass-card border-0">
              <CardContent className="p-12 text-center">
                <AlertCircle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
                <h2 className="font-heading text-2xl font-bold text-white mb-2">No Team Assigned</h2>
                <p className="text-slate-400 mb-6">
                  You haven't been assigned to a team yet. Please contact the administrator.
                </p>
                {auctionState?.is_active && (
                  <Button 
                    onClick={() => navigate('/auction')}
                    className="btn-primary"
                  >
                    <Radio className="w-4 h-4 mr-2" />
                    Watch Live Auction
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </Layout>
    );
  }

  const totalSpent = team.budget - team.remaining_budget;
  const budgetUsedPercent = (totalSpent / team.budget) * 100;

  return (
    <Layout>
      <div className="p-6 lg:p-8">
        <div className="container-main">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div className="flex items-center gap-4">
              {team.logo_url ? (
                <img src={team.logo_url} alt={team.name} className="w-16 h-16 rounded-xl object-cover" />
              ) : (
                <div className="team-logo w-16 h-16 text-3xl text-blue-400">
                  {team.short_name?.charAt(0) || team.name.charAt(0)}
                </div>
              )}
              <div>
                <h1 className="font-heading text-3xl font-bold text-white tracking-tight">{team.name}</h1>
                <span className="badge-role">{team.short_name}</span>
              </div>
            </div>
            
            {auctionState?.is_active && (
              <Button 
                data-testid="join-auction-btn"
                onClick={() => navigate('/auction')}
                className="bg-green-600 hover:bg-green-500 text-white font-bold flex items-center gap-2"
              >
                <Radio className="w-4 h-4 animate-pulse" />
                Join Live Auction
              </Button>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="glass-card border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">Total Budget</p>
                    <p className="stat-value mt-1 font-mono">{formatPrice(team.budget)}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <IndianRupee className="w-6 h-6 text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">Remaining</p>
                    <p className="stat-value mt-1 font-mono text-green-400">{formatPrice(team.remaining_budget)}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <IndianRupee className="w-6 h-6 text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">Spent</p>
                    <p className="stat-value mt-1 font-mono text-yellow-400">{formatPrice(totalSpent)}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                    <Trophy className="w-6 h-6 text-yellow-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">Squad Size</p>
                    <p className="stat-value mt-1">{squad.length}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Users className="w-6 h-6 text-purple-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Budget Progress */}
          <Card className="glass-card border-0 mb-8">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-400">Budget Used</span>
                <span className="font-mono text-white">{budgetUsedPercent.toFixed(1)}%</span>
              </div>
              <div className="h-4 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-green-500 to-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${budgetUsedPercent}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Export Section */}
          <Card className="glass-card border-0 mb-8">
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-white text-lg flex items-center gap-2">
                <Download className="w-5 h-5 text-blue-400" />
                Download Team Data
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-slate-400 text-sm mb-4">Export your team details, squad information, and auction data</p>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={() => window.open(`${API}/team-owner/export/excel`, '_blank')}
                  className="border-green-500/50 text-green-400 hover:bg-green-500/10"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Download Excel
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.open(`${API}/team-owner/export/pdf`, '_blank')}
                  className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Download PDF Report
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Squad Composition */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className="glass-card border-0">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-white">{getRoleCount('batsman')}</p>
                <p className="text-xs text-slate-500 uppercase">Batsmen</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-0">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-white">{getRoleCount('bowler')}</p>
                <p className="text-xs text-slate-500 uppercase">Bowlers</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-0">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-white">{getRoleCount('all-rounder')}</p>
                <p className="text-xs text-slate-500 uppercase">All-Rounders</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-0">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-white">{getRoleCount('wicket-keeper')}</p>
                <p className="text-xs text-slate-500 uppercase">Keepers</p>
              </CardContent>
            </Card>
          </div>

          {/* Squad List */}
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="font-heading text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                Your Squad
              </CardTitle>
            </CardHeader>
            <CardContent>
              {squad.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {squad.map((player, index) => (
                    <div
                      key={player.player_id}
                      className="flex items-center gap-4 p-4 bg-slate-800/30 rounded-xl animate-fade-in-up"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <img
                        src={player.image_url || 'https://images.unsplash.com/photo-1583072728920-4ed8c72cbc01?w=100&h=100&fit=crop'}
                        alt={player.name}
                        className="w-14 h-14 rounded-lg object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">{player.name}</p>
                        <span className="badge-role text-[10px]">{player.role}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-green-400 font-bold">{formatPrice(player.sold_price)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No players in your squad yet</p>
                  <p className="text-sm mt-2">Win bids in the auction to build your team!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default TeamOwnerDashboard;
