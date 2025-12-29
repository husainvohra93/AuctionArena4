import React, { useState, useEffect, useContext } from 'react';
import Layout from '@/components/Layout';
import { AuthContext } from '@/App';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Gavel, 
  Radio, 
  Coins,
  TrendingUp,
  Users,
  AlertCircle
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const LiveAuction = () => {
  const { user } = useContext(AuthContext);
  const [auctionState, setAuctionState] = useState(null);
  const [teams, setTeams] = useState([]);
  const [myTeam, setMyTeam] = useState(null);
  const [bidAmount, setBidAmount] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchAuctionState, 1500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (user?.team_id && teams.length > 0) {
      const team = teams.find(t => t.team_id === user.team_id);
      setMyTeam(team);
    }
  }, [user, teams]);

  const fetchData = async () => {
    try {
      await Promise.all([
        fetchAuctionState(),
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
      
      // Update bid amount suggestion
      if (response.data.current_bid && !bidAmount) {
        setBidAmount(getNextBidAmount(response.data.current_bid));
      }
    } catch (error) {
      console.error('Error fetching auction state:', error);
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

  const getNextBidAmount = (currentBid) => {
    if (currentBid >= 10000000) return currentBid + 2500000;
    if (currentBid >= 5000000) return currentBid + 1000000;
    if (currentBid >= 1000000) return currentBid + 500000;
    if (currentBid >= 500000) return currentBid + 100000;
    return currentBid + 50000;
  };

  const handleBid = async () => {
    if (!myTeam && user?.role !== 'admin') {
      toast.error('You must be assigned to a team to bid');
      return;
    }

    const teamId = myTeam?.team_id || teams[0]?.team_id;
    if (!teamId) {
      toast.error('No team available for bidding');
      return;
    }

    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid bid amount');
      return;
    }

    try {
      await axios.post(`${API}/auction/bid`, 
        { team_id: teamId, amount },
        { withCredentials: true }
      );
      toast.success('Bid placed successfully!');
      setBidAmount(getNextBidAmount(amount).toString());
      fetchAuctionState();
      fetchTeams();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to place bid');
    }
  };

  const handleQuickBid = (increment) => {
    const currentBid = auctionState?.current_bid || 0;
    const newBid = currentBid + increment;
    setBidAmount(newBid.toString());
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
  const isAuctionActive = auctionState?.is_active;
  const canBid = isAuctionActive && currentPlayer && (myTeam || user?.role === 'admin');

  return (
    <Layout>
      <div className="h-[calc(100vh-64px)] overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full p-4 lg:p-6">
          {/* Left - Current Player (8 cols) */}
          <div className="lg:col-span-8 flex flex-col">
            {/* Status Bar */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                {isAuctionActive ? (
                  <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-full">
                    <Radio className="w-4 h-4 text-green-400 animate-pulse" />
                    <span className="text-green-400 font-bold uppercase tracking-wider">Live Auction</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-2 bg-slate-500/20 border border-slate-500/50 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    <span className="text-slate-400 font-medium uppercase tracking-wider">Auction Paused</span>
                  </div>
                )}
              </div>
              
              {myTeam && (
                <div className="flex items-center gap-3 px-4 py-2 bg-slate-800/50 rounded-lg">
                  <span className="text-slate-400 text-sm">Your Budget:</span>
                  <span className="font-mono font-bold text-green-400">{formatPrice(myTeam.remaining_budget)}</span>
                </div>
              )}
            </div>

            {/* Player Card */}
            <Card className="glass-card border-0 flex-1 overflow-hidden player-spotlight">
              <CardContent className="p-0 h-full">
                {currentPlayer ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 h-full">
                    {/* Player Image */}
                    <div className="relative h-64 md:h-full bg-gradient-to-br from-slate-900 to-slate-800">
                      <img
                        src={currentPlayer.image_url || 'https://images.unsplash.com/photo-1583072728920-4ed8c72cbc01?w=600&h=800&fit=crop'}
                        alt={currentPlayer.name}
                        className="absolute inset-0 w-full h-full object-cover opacity-80"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
                      
                      {/* Player Info Overlay */}
                      <div className="absolute bottom-0 left-0 right-0 p-6">
                        <span className="badge-in-auction mb-2 inline-block">In Auction</span>
                        <h1 className="font-heading text-4xl md:text-5xl font-black text-white tracking-tight">
                          {currentPlayer.name}
                        </h1>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="badge-role">{currentPlayer.role}</span>
                          {currentPlayer.age && (
                            <span className="text-slate-400 text-sm">{currentPlayer.age} years</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bidding Section */}
                    <div className="p-6 flex flex-col">
                      {/* Stats */}
                      {(currentPlayer.matches > 0 || currentPlayer.runs > 0 || currentPlayer.wickets > 0) && (
                        <div className="grid grid-cols-3 gap-4 mb-6">
                          <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                            <p className="font-mono text-2xl font-bold text-white">{currentPlayer.matches || 0}</p>
                            <p className="text-xs text-slate-500 uppercase">Matches</p>
                          </div>
                          <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                            <p className="font-mono text-2xl font-bold text-white">{currentPlayer.runs || 0}</p>
                            <p className="text-xs text-slate-500 uppercase">Runs</p>
                          </div>
                          <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                            <p className="font-mono text-2xl font-bold text-white">{currentPlayer.wickets || 0}</p>
                            <p className="text-xs text-slate-500 uppercase">Wickets</p>
                          </div>
                        </div>
                      )}

                      {/* Current Bid */}
                      <div className="mb-6">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="w-4 h-4 text-green-400" />
                          <span className="text-xs text-slate-500 uppercase tracking-wider">Current Bid</span>
                        </div>
                        <p className="font-mono text-5xl font-black text-green-400 animate-count-up">
                          {formatPrice(auctionState.current_bid)}
                        </p>
                        {auctionState.current_bidder_name && (
                          <p className="text-slate-400 mt-2">
                            by <span className="text-white font-semibold">{auctionState.current_bidder_name}</span>
                          </p>
                        )}
                      </div>

                      {/* Base Price */}
                      <div className="mb-6 p-4 bg-slate-800/30 rounded-lg">
                        <span className="text-xs text-slate-500 uppercase">Base Price</span>
                        <p className="font-mono text-xl text-white">{formatPrice(currentPlayer.base_price)}</p>
                      </div>

                      {/* Bid Input */}
                      <div className="mt-auto">
                        <div className="flex gap-2 mb-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleQuickBid(50000)}
                            className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
                          >
                            +50K
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleQuickBid(100000)}
                            className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
                          >
                            +1L
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleQuickBid(500000)}
                            className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
                          >
                            +5L
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleQuickBid(1000000)}
                            className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
                          >
                            +10L
                          </Button>
                        </div>
                        
                        <div className="flex gap-3">
                          <div className="flex-1 relative">
                            <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                            <Input
                              data-testid="bid-amount-input"
                              type="number"
                              value={bidAmount}
                              onChange={(e) => setBidAmount(e.target.value)}
                              placeholder="Enter bid amount"
                              className="pl-10 h-14 text-xl font-mono bg-slate-800 border-slate-700 text-white"
                            />
                          </div>
                          <Button
                            data-testid="place-bid-btn"
                            onClick={handleBid}
                            disabled={!canBid}
                            className="h-14 px-8 btn-bid"
                          >
                            <Gavel className="w-5 h-5 mr-2" />
                            BID
                          </Button>
                        </div>
                        
                        {!canBid && isAuctionActive && (
                          <p className="text-sm text-yellow-400 mt-2 flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" />
                            {!myTeam && user?.role !== 'admin' 
                              ? 'You need to be assigned to a team to bid' 
                              : 'Waiting for player...'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center py-12 text-slate-500">
                      <Gavel className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p className="text-xl">Waiting for next player...</p>
                      <p className="text-sm mt-2">The auctioneer will bring up the next player shortly</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right - Teams & Bid History (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            {/* Bid History */}
            <Card className="glass-card border-0 flex-1">
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-white text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  Bid History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  {auctionState?.bid_history?.length > 0 ? (
                    <div className="space-y-2">
                      {[...auctionState.bid_history].reverse().map((bid, index) => (
                        <div 
                          key={index}
                          className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                            index === 0 ? 'bg-green-500/10 border border-green-500/30' : 'bg-slate-800/30'
                          }`}
                        >
                          <span className={`font-medium ${index === 0 ? 'text-green-400' : 'text-white'}`}>
                            {bid.team_name}
                          </span>
                          <span className={`font-mono ${index === 0 ? 'text-green-400 font-bold' : 'text-slate-400'}`}>
                            {formatPrice(bid.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <p>No bids yet</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Teams Overview */}
            <Card className="glass-card border-0 flex-1">
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-white text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  Teams
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {teams.map((team) => (
                      <div
                        key={team.team_id}
                        className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                          team.team_id === auctionState?.current_bidder_id 
                            ? 'bg-green-500/10 border border-green-500/30' 
                            : team.team_id === myTeam?.team_id 
                              ? 'bg-blue-500/10 border border-blue-500/30'
                              : 'bg-slate-800/30'
                        }`}
                      >
                        <div className="team-logo w-10 h-10 text-lg text-blue-400">
                          {team.short_name?.charAt(0) || team.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate text-sm">{team.name}</p>
                          <p className="text-xs text-slate-500">{team.players?.length || 0} players</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-sm text-green-400">{formatPrice(team.remaining_budget)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default LiveAuction;
