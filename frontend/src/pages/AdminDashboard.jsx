import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import axios from 'axios';
import { Users, UserCircle, Gavel, IndianRupee, TrendingUp, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [recentPlayers, setRecentPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, playersRes, teamsRes] = await Promise.all([
        axios.get(`${API}/stats/dashboard`, { withCredentials: true }),
        axios.get(`${API}/players?status=sold`, { withCredentials: true }),
        axios.get(`${API}/teams`, { withCredentials: true })
      ]);
      
      setStats(statsRes.data);
      setRecentPlayers(playersRes.data.slice(-5).reverse());
      setTeams(teamsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTeamName = (teamId) => {
    const team = teams.find(t => t.team_id === teamId);
    return team?.name || team?.short_name || 'Unknown';
  };

  const formatPrice = (price) => {
    if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
    if (price >= 100000) return `₹${(price / 100000).toFixed(2)} L`;
    return `₹${price?.toLocaleString()}`;
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

  return (
    <Layout>
      <div className="p-6 lg:p-8">
        <div className="container-main">
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-heading text-3xl font-bold text-white tracking-tight">Dashboard</h1>
            <p className="text-slate-400 mt-1">Overview of your cricket auction</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="glass-card border-0" data-testid="stat-total-players">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">Total Players</p>
                    <p className="stat-value mt-1">{stats?.total_players || 0}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <UserCircle className="w-6 h-6 text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card border-0" data-testid="stat-sold-players">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">Sold Players</p>
                    <p className="stat-value mt-1 text-green-400">{stats?.sold_players || 0}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <Gavel className="w-6 h-6 text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card border-0" data-testid="stat-total-teams">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">Total Teams</p>
                    <p className="stat-value mt-1">{stats?.total_teams || 0}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Users className="w-6 h-6 text-purple-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card border-0" data-testid="stat-total-spent">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">Total Spent</p>
                    <p className="stat-value mt-1 text-yellow-400 font-mono">{formatPrice(stats?.total_spent || 0)}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                    <IndianRupee className="w-6 h-6 text-yellow-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Sales */}
            <Card className="glass-card border-0">
              <CardHeader className="pb-4">
                <CardTitle className="font-heading text-lg text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  Recent Sales
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentPlayers.length > 0 ? (
                  <div className="space-y-4">
                    {recentPlayers.map((player, index) => (
                      <div 
                        key={player.player_id} 
                        className="flex items-center gap-4 p-3 rounded-lg bg-slate-800/30"
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <img 
                          src={player.image_url || 'https://images.unsplash.com/photo-1583072728920-4ed8c72cbc01?w=100&h=100&fit=crop'} 
                          alt={player.name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white truncate">{player.name}</p>
                          <p className="text-xs text-slate-500 uppercase">{player.role}</p>
                        </div>
                        <p className="font-mono text-green-400 font-bold">{formatPrice(player.sold_price)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No players sold yet</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Teams Overview */}
            <Card className="glass-card border-0">
              <CardHeader className="pb-4">
                <CardTitle className="font-heading text-lg text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  Teams Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                {teams.length > 0 ? (
                  <div className="space-y-4">
                    {teams.slice(0, 5).map((team, index) => (
                      <div 
                        key={team.team_id}
                        className="flex items-center gap-4 p-3 rounded-lg bg-slate-800/30"
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <div className="team-logo text-blue-400">
                          {team.short_name?.charAt(0) || team.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white truncate">{team.name}</p>
                          <p className="text-xs text-slate-500">{team.players?.length || 0} players</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-sm text-white">{formatPrice(team.remaining_budget)}</p>
                          <p className="text-xs text-slate-500">remaining</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No teams created yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Stats Bar */}
          <div className="mt-8 glass-card p-4 flex flex-wrap items-center justify-around gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-white tabular-nums">{stats?.unsold_players || 0}</p>
              <p className="text-xs text-slate-500 uppercase tracking-wider">Unsold</p>
            </div>
            <div className="w-px h-10 bg-slate-700 hidden sm:block" />
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-400 tabular-nums">{stats?.in_auction || 0}</p>
              <p className="text-xs text-slate-500 uppercase tracking-wider">In Auction</p>
            </div>
            <div className="w-px h-10 bg-slate-700 hidden sm:block" />
            <div className="text-center">
              <p className="text-2xl font-bold text-green-400 tabular-nums">
                {stats?.total_players ? Math.round((stats.sold_players / stats.total_players) * 100) : 0}%
              </p>
              <p className="text-xs text-slate-500 uppercase tracking-wider">Complete</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AdminDashboard;
