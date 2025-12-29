import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Play, 
  Pause, 
  Square,
  RotateCcw, 
  Gavel, 
  X, 
  ChevronRight,
  Radio,
  AlertTriangle,
  Minus,
  Users,
  ExternalLink,
  ArrowLeft,
  Shuffle,
  RefreshCw
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useParams, useNavigate } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminAuctionControl = () => {
  const { auctionId } = useParams();
  const navigate = useNavigate();
  const [auction, setAuction] = useState(null);
  const [unsoldPlayers, setUnsoldPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchAuctionState, 1500);
    return () => clearInterval(interval);
  }, [auctionId]);

  const fetchData = async () => {
    try {
      await Promise.all([
        fetchAuctionState(),
        fetchUnsoldPlayers()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuctionState = async () => {
    try {
      const response = await axios.get(`${API}/auctions/${auctionId}`, { withCredentials: true });
      setAuction(response.data);
    } catch (error) {
      console.error('Error fetching auction:', error);
    }
  };

  const fetchUnsoldPlayers = async () => {
    try {
      const auctionRes = await axios.get(`${API}/auctions/${auctionId}`, { withCredentials: true });
      const tournamentId = auctionRes.data.tournament_id;
      const response = await axios.get(`${API}/players?status=unsold&tournament_id=${tournamentId}`, { withCredentials: true });
      setUnsoldPlayers(response.data);
    } catch (error) {
      console.error('Error fetching players:', error);
    }
  };

  const handleStartAuction = async () => {
    try {
      await axios.post(`${API}/auctions/${auctionId}/start`, {}, { withCredentials: true });
      toast.success('Auction started!');
      fetchAuctionState();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start auction');
    }
  };

  const handlePauseAuction = async () => {
    try {
      await axios.post(`${API}/auctions/${auctionId}/pause`, {}, { withCredentials: true });
      toast.success('Auction paused');
      fetchAuctionState();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to pause auction');
    }
  };

  const handleStopAuction = async () => {
    try {
      await axios.post(`${API}/auctions/${auctionId}/stop`, {}, { withCredentials: true });
      toast.success('Auction stopped');
      fetchAuctionState();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to stop auction');
    }
  };

  const handleSetPlayer = async (playerId) => {
    try {
      await axios.post(`${API}/auctions/${auctionId}/set-player/${playerId}`, {}, { withCredentials: true });
      toast.success('Player set for auction');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to set player');
    }
  };

  const handleTeamBid = async (teamId) => {
    try {
      await axios.post(`${API}/auctions/${auctionId}/admin-bid`, { team_id: teamId }, { withCredentials: true });
      toast.success('Bid placed!');
      fetchAuctionState();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to place bid');
    }
  };

  const handleDecreaseBid = async () => {
    try {
      await axios.post(`${API}/auctions/${auctionId}/decrease-bid`, {}, { withCredentials: true });
      toast.info('Bid decreased');
      fetchAuctionState();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to decrease bid');
    }
  };

  const handleSellPlayer = async () => {
    try {
      await axios.post(`${API}/auctions/${auctionId}/sell`, {}, { withCredentials: true });
      toast.success('Player sold!');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to sell player');
    }
  };

  const handleMarkUnsold = async () => {
    try {
      await axios.post(`${API}/auctions/${auctionId}/unsold`, {}, { withCredentials: true });
      toast.info('Player marked as unsold');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to mark unsold');
    }
  };

  const handleResetAuction = async () => {
    try {
      await axios.post(`${API}/auctions/${auctionId}/reset`, {}, { withCredentials: true });
      toast.success('Auction reset successfully');
      setResetDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reset auction');
    }
  };

  const formatPrice = (price) => {
    if (price >= 10000000) return `${(price / 10000000).toFixed(2)} Cr Pts`;
    if (price >= 100000) return `${(price / 100000).toFixed(2)} L Pts`;
    if (price >= 1000) return `${(price / 1000).toFixed(1)}K Pts`;
    return `${price?.toLocaleString()} Pts`;
  };

  const openViewScreen = () => {
    window.open(`/auction/${auctionId}/view`, '_blank');
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

  const currentPlayer = auction?.current_player;
  const teams = auction?.teams || [];
  const isLive = auction?.status === 'live';

  return (
    <Layout>
      <div className="p-4 lg:p-6 h-[calc(100vh-64px)] overflow-hidden">
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(-1)}
                className="text-slate-400 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="font-heading text-2xl font-bold text-white">{auction?.name}</h1>
                <p className="text-slate-400 text-sm">Admin Control Panel</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {isLive ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-full">
                  <Radio className="w-4 h-4 text-green-400 animate-pulse" />
                  <span className="text-green-400 font-bold">LIVE</span>
                </div>
              ) : auction?.status === 'paused' ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 border border-yellow-500/50 rounded-full">
                  <span className="text-yellow-400 font-bold">PAUSED</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-500/20 border border-slate-500/50 rounded-full">
                  <span className="text-slate-400 font-bold">{auction?.status?.toUpperCase()}</span>
                </div>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={openViewScreen}
                className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                View Screen
              </Button>
            </div>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
            {/* Left - Controls & Current Player (8 cols) */}
            <div className="col-span-8 flex flex-col gap-4 min-h-0">
              {/* Auction Controls */}
              <Card className="glass-card border-0 flex-shrink-0">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    {!isLive ? (
                      <Button 
                        data-testid="start-auction-btn"
                        onClick={handleStartAuction}
                        className="bg-green-600 hover:bg-green-500 text-white font-bold"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Start Auction
                      </Button>
                    ) : (
                      <Button 
                        data-testid="pause-auction-btn"
                        onClick={handlePauseAuction}
                        className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold"
                      >
                        <Pause className="w-4 h-4 mr-2" />
                        Pause
                      </Button>
                    )}
                    
                    <Button 
                      onClick={handleStopAuction}
                      variant="outline"
                      className="border-slate-700 text-slate-300"
                    >
                      <Square className="w-4 h-4 mr-2" />
                      Stop
                    </Button>
                    
                    <Button 
                      variant="outline"
                      onClick={() => setResetDialogOpen(true)}
                      className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Reset All
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Current Player & Bidding */}
              <Card className="glass-card border-0 flex-1 min-h-0 overflow-hidden">
                <CardContent className="p-4 h-full">
                  {currentPlayer ? (
                    <div className="h-full flex flex-col">
                      <div className="flex gap-4 mb-4">
                        <img
                          src={currentPlayer.image_url || 'https://images.unsplash.com/photo-1583072728920-4ed8c72cbc01?w=200&h=250&fit=crop'}
                          alt={currentPlayer.name}
                          className="w-32 h-40 object-cover rounded-xl"
                        />
                        <div className="flex-1">
                          <h2 className="font-heading text-2xl font-bold text-white">{currentPlayer.name}</h2>
                          <span className="badge-role">{currentPlayer.role}</span>
                          
                          <div className="grid grid-cols-2 gap-3 mt-4">
                            <div className="bg-slate-800/50 rounded-lg p-3">
                              <p className="text-xs text-slate-500">Base Price</p>
                              <p className="font-mono text-lg font-bold text-white">{formatPrice(currentPlayer.base_price)}</p>
                            </div>
                            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                              <p className="text-xs text-green-400">Current Bid</p>
                              <p className="font-mono text-xl font-bold text-green-400">{formatPrice(auction.current_bid)}</p>
                            </div>
                          </div>
                          
                          {auction.current_bidder_name && (
                            <div className="mt-3 p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                              <p className="text-xs text-blue-400">Highest Bidder</p>
                              <p className="font-bold text-white">{auction.current_bidder_name}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Team Bid Buttons */}
                      <div className="flex-1 min-h-0">
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Click team to bid</p>
                        <ScrollArea className="h-[calc(100%-80px)]">
                          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                            {teams.map((team) => (
                              <Button
                                key={team.team_id}
                                data-testid={`team-bid-btn-${team.team_id}`}
                                onClick={() => handleTeamBid(team.team_id)}
                                disabled={!isLive || team.remaining_budget < auction.current_bid}
                                className={`h-auto py-3 px-4 flex flex-col items-start gap-1 ${
                                  auction.current_bidder_id === team.team_id
                                    ? 'bg-green-600 hover:bg-green-500 border-2 border-green-400'
                                    : 'bg-slate-800 hover:bg-slate-700 border border-slate-700'
                                } ${team.remaining_budget < auction.current_bid ? 'opacity-50' : ''}`}
                              >
                                <span className="font-bold text-white text-left">{team.short_name || team.name}</span>
                                <span className="text-xs text-slate-400 font-mono">{formatPrice(team.remaining_budget)}</span>
                              </Button>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-3 mt-4 flex-shrink-0">
                        <Button
                          onClick={handleDecreaseBid}
                          variant="outline"
                          className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
                        >
                          <Minus className="w-4 h-4 mr-1" />
                          Decrease Bid
                        </Button>
                        <Button
                          data-testid="sell-player-btn"
                          onClick={handleSellPlayer}
                          disabled={!auction.current_bidder_id}
                          className="flex-1 btn-bid"
                        >
                          <Gavel className="w-5 h-5 mr-2" />
                          SOLD!
                        </Button>
                        <Button
                          onClick={handleMarkUnsold}
                          variant="outline"
                          className="border-slate-700 text-slate-300"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Unsold
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center text-slate-500">
                        <Gavel className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <p className="text-lg">Select a player to start bidding</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right - Player Pool & Teams (4 cols) */}
            <div className="col-span-4 flex flex-col gap-4 min-h-0">
              {/* Player Pool */}
              <Card className="glass-card border-0 flex-1 min-h-0">
                <CardHeader className="pb-2 flex-shrink-0">
                  <CardTitle className="font-heading text-white text-sm flex items-center justify-between">
                    <span>Player Pool</span>
                    <span className="text-slate-400 font-normal">{unsoldPlayers.length} unsold</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                  <ScrollArea className="h-[30vh]">
                    <div className="space-y-1">
                      {unsoldPlayers.map((player) => (
                        <div
                          key={player.player_id}
                          data-testid={`pool-player-${player.player_id}`}
                          onClick={() => handleSetPlayer(player.player_id)}
                          className="flex items-center gap-2 p-2 bg-slate-800/30 rounded-lg hover:bg-slate-800/50 cursor-pointer group"
                        >
                          <img
                            src={player.image_url || 'https://images.unsplash.com/photo-1583072728920-4ed8c72cbc01?w=50&h=50&fit=crop'}
                            alt={player.name}
                            className="w-8 h-8 rounded object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">{player.name}</p>
                            <p className="text-xs text-slate-500">{formatPrice(player.base_price)}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400" />
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Team Holdings */}
              <Card className="glass-card border-0 flex-1 min-h-0">
                <CardHeader className="pb-2 flex-shrink-0">
                  <CardTitle className="font-heading text-white text-sm flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-400" />
                    Team Holdings
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                  <ScrollArea className="h-[30vh]">
                    <div className="space-y-2">
                      {teams.map((team) => (
                        <div key={team.team_id} className="p-3 bg-slate-800/30 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-white">{team.short_name || team.name}</span>
                            <span className="font-mono text-green-400 text-sm">{formatPrice(team.remaining_budget)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Users className="w-3 h-3" />
                            <span>{team.players?.length || 0} / {auction?.players_per_team || 15} players</span>
                          </div>
                          <div className="w-full bg-slate-700 rounded-full h-1.5 mt-2">
                            <div 
                              className="bg-blue-500 h-1.5 rounded-full" 
                              style={{ width: `${((team.players?.length || 0) / (auction?.players_per_team || 15)) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Reset Dialog */}
          <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
            <AlertDialogContent className="bg-slate-900 border-slate-700">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                  Reset Entire Auction?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-slate-400">
                  This will reset all players to unsold and restore all team budgets. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-slate-800 border-slate-700 text-slate-300">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetAuction} className="bg-red-600 hover:bg-red-500">Reset All</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </Layout>
  );
};

export default AdminAuctionControl;
