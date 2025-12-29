import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Gavel, 
  X, 
  ChevronRight,
  Radio,
  AlertTriangle
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

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AuctionControl = () => {
  const [auctionState, setAuctionState] = useState(null);
  const [unsoldPlayers, setUnsoldPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchAuctionState, 2000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      await Promise.all([
        fetchAuctionState(),
        fetchUnsoldPlayers(),
        fetchTeams()
      ]);
    } finally {
      setLoading(false);
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

  const fetchUnsoldPlayers = async () => {
    try {
      const response = await axios.get(`${API}/players?status=unsold`, { withCredentials: true });
      setUnsoldPlayers(response.data);
    } catch (error) {
      console.error('Error fetching players:', error);
    }
  };

  const fetchTeams = async () => {
    try {
      const response = await axios.get(`${API}/teams`, { withCredentials: true });
      setTeams(response.data);
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  };

  const handleStartAuction = async () => {
    try {
      await axios.post(`${API}/auction/start`, {}, { withCredentials: true });
      toast.success('Auction started!');
      fetchAuctionState();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start auction');
    }
  };

  const handleStopAuction = async () => {
    try {
      await axios.post(`${API}/auction/stop`, {}, { withCredentials: true });
      toast.success('Auction paused');
      fetchAuctionState();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to stop auction');
    }
  };

  const handleSetPlayer = async (playerId) => {
    try {
      await axios.post(`${API}/auction/set-player/${playerId}`, {}, { withCredentials: true });
      toast.success('Player set for auction');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to set player');
    }
  };

  const handleSellPlayer = async () => {
    try {
      await axios.post(`${API}/auction/sell`, {}, { withCredentials: true });
      toast.success('Player sold!');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to sell player');
    }
  };

  const handleMarkUnsold = async () => {
    try {
      await axios.post(`${API}/auction/unsold`, {}, { withCredentials: true });
      toast.info('Player marked as unsold');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to mark unsold');
    }
  };

  const handleResetAuction = async () => {
    try {
      await axios.post(`${API}/auction/reset`, {}, { withCredentials: true });
      toast.success('Auction reset successfully');
      setResetDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reset auction');
    }
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

  const currentPlayer = auctionState?.current_player;

  return (
    <Layout>
      <div className="p-6 lg:p-8">
        <div className="container-main">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="font-heading text-3xl font-bold text-white tracking-tight">Auction Control</h1>
              <p className="text-slate-400 mt-1">Manage the live auction</p>
            </div>
            
            <div className="flex items-center gap-3">
              {auctionState?.is_active ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-full">
                  <Radio className="w-4 h-4 text-green-400 animate-pulse" />
                  <span className="text-green-400 font-medium">LIVE</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-500/20 border border-slate-500/50 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  <span className="text-slate-400 font-medium">PAUSED</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Controls & Current Player */}
            <div className="lg:col-span-2 space-y-6">
              {/* Auction Controls */}
              <Card className="glass-card border-0">
                <CardHeader>
                  <CardTitle className="font-heading text-white flex items-center gap-2">
                    <Gavel className="w-5 h-5 text-blue-400" />
                    Auction Controls
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4">
                    {!auctionState?.is_active ? (
                      <Button 
                        data-testid="start-auction-btn"
                        onClick={handleStartAuction}
                        className="bg-green-600 hover:bg-green-500 text-white font-bold flex items-center gap-2"
                      >
                        <Play className="w-4 h-4" />
                        Start Auction
                      </Button>
                    ) : (
                      <Button 
                        data-testid="pause-auction-btn"
                        onClick={handleStopAuction}
                        className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold flex items-center gap-2"
                      >
                        <Pause className="w-4 h-4" />
                        Pause Auction
                      </Button>
                    )}
                    
                    <Button 
                      data-testid="reset-auction-btn"
                      variant="outline"
                      onClick={() => setResetDialogOpen(true)}
                      className="border-red-500/50 text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reset All
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Current Player */}
              <Card className="glass-card border-0">
                <CardHeader>
                  <CardTitle className="font-heading text-white">Current Player</CardTitle>
                </CardHeader>
                <CardContent>
                  {currentPlayer ? (
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="w-full md:w-48 flex-shrink-0">
                        <img
                          src={currentPlayer.image_url || 'https://images.unsplash.com/photo-1583072728920-4ed8c72cbc01?w=300&h=400&fit=crop'}
                          alt={currentPlayer.name}
                          className="w-full aspect-[3/4] object-cover rounded-xl"
                        />
                      </div>
                      <div className="flex-1">
                        <h2 className="font-heading text-3xl font-bold text-white mb-2">{currentPlayer.name}</h2>
                        <span className="badge-role text-sm">{currentPlayer.role}</span>
                        
                        <div className="grid grid-cols-2 gap-4 mt-6">
                          <div className="bg-slate-800/50 rounded-lg p-4">
                            <p className="text-xs text-slate-500 uppercase">Base Price</p>
                            <p className="font-mono text-xl font-bold text-white">{formatPrice(currentPlayer.base_price)}</p>
                          </div>
                          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                            <p className="text-xs text-green-400 uppercase">Current Bid</p>
                            <p className="font-mono text-xl font-bold text-green-400 animate-count-up">
                              {formatPrice(auctionState.current_bid)}
                            </p>
                          </div>
                        </div>

                        {auctionState.current_bidder_name && (
                          <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                            <p className="text-xs text-blue-400 uppercase">Highest Bidder</p>
                            <p className="font-heading text-xl font-bold text-white">{auctionState.current_bidder_name}</p>
                          </div>
                        )}

                        <div className="flex gap-3 mt-6">
                          <Button
                            data-testid="sell-player-btn"
                            onClick={handleSellPlayer}
                            disabled={!auctionState.current_bidder_id}
                            className="btn-bid flex-1"
                          >
                            <Gavel className="w-5 h-5 mr-2" />
                            SOLD!
                          </Button>
                          <Button
                            data-testid="unsold-btn"
                            onClick={handleMarkUnsold}
                            variant="outline"
                            className="border-slate-700 text-slate-300 hover:bg-slate-800"
                          >
                            <X className="w-4 h-4 mr-1" />
                            Unsold
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-500">
                      <Gavel className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No player currently in auction</p>
                      <p className="text-sm mt-2">Select a player from the pool to start bidding</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Bid History */}
              {auctionState?.bid_history?.length > 0 && (
                <Card className="glass-card border-0">
                  <CardHeader>
                    <CardTitle className="font-heading text-white">Bid History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {[...auctionState.bid_history].reverse().map((bid, index) => (
                        <div 
                          key={index}
                          className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg"
                        >
                          <span className="text-white font-medium">{bid.team_name}</span>
                          <span className="font-mono text-green-400">{formatPrice(bid.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column - Player Pool */}
            <div>
              <Card className="glass-card border-0 sticky top-6">
                <CardHeader>
                  <CardTitle className="font-heading text-white flex items-center justify-between">
                    <span>Player Pool</span>
                    <span className="text-sm font-normal text-slate-400">{unsoldPlayers.length} unsold</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {unsoldPlayers.map((player) => (
                      <div
                        key={player.player_id}
                        data-testid={`pool-player-${player.player_id}`}
                        className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-lg hover:bg-slate-800/50 transition-colors cursor-pointer group"
                        onClick={() => handleSetPlayer(player.player_id)}
                      >
                        <img
                          src={player.image_url || 'https://images.unsplash.com/photo-1583072728920-4ed8c72cbc01?w=100&h=100&fit=crop'}
                          alt={player.name}
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">{player.name}</p>
                          <p className="text-xs text-slate-500">{formatPrice(player.base_price)}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400 transition-colors" />
                      </div>
                    ))}
                    
                    {unsoldPlayers.length === 0 && (
                      <div className="text-center py-8 text-slate-500">
                        <p>All players have been auctioned!</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Reset Confirmation Dialog */}
          <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
            <AlertDialogContent className="bg-slate-900 border-slate-700">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                  Reset Entire Auction?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-slate-400">
                  This will reset all players to unsold status and restore all team budgets. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleResetAuction}
                  className="bg-red-600 hover:bg-red-500 text-white"
                >
                  Reset All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </Layout>
  );
};

export default AuctionControl;
