import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { Gavel, TrendingUp, Users, Trophy } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AuctionViewScreen = () => {
  const { auctionId } = useParams();
  const [auction, setAuction] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAuction();
    const interval = setInterval(fetchAuction, 1000); // Poll every second for real-time feel
    return () => clearInterval(interval);
  }, [auctionId]);

  const fetchAuction = async () => {
    try {
      const response = await axios.get(`${API}/auctions/${auctionId}`);
      setAuction(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching auction:', error);
    }
  };

  const formatPrice = (price) => {
    if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
    if (price >= 100000) return `₹${(price / 100000).toFixed(2)} L`;
    if (price >= 1000) return `₹${(price / 1000).toFixed(1)}K`;
    return `₹${price?.toLocaleString()}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  const currentPlayer = auction?.current_player;
  const teams = auction?.teams || [];
  const isLive = auction?.status === 'live';

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden">
      {/* Background */}
      <div 
        className="fixed inset-0 bg-cover bg-center opacity-30"
        style={{ 
          backgroundImage: 'url(https://images.unsplash.com/photo-1750716413756-b66624b64ce4?w=1920&q=80)'
        }}
      />
      
      {/* Header */}
      <header className="relative z-10 bg-slate-900/80 backdrop-blur-lg border-b border-slate-800 px-8 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Trophy className="w-10 h-10 text-yellow-400" />
            <div>
              <h1 className="font-heading text-2xl font-black tracking-tight">
                CRICKET<span className="text-blue-500">MART</span>
              </h1>
              <p className="text-slate-400 text-sm">{auction?.name}</p>
            </div>
          </div>
          
          {isLive ? (
            <div className="flex items-center gap-3 px-6 py-3 bg-red-500/20 border border-red-500/50 rounded-full animate-pulse">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
              <span className="text-red-400 font-black text-xl uppercase tracking-wider">LIVE</span>
            </div>
          ) : (
            <div className="px-6 py-3 bg-slate-500/20 border border-slate-500/50 rounded-full">
              <span className="text-slate-400 font-bold uppercase">{auction?.status}</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 p-8">
        <div className="max-w-7xl mx-auto">
          {currentPlayer ? (
            <div className="grid grid-cols-12 gap-8">
              {/* Player Card - 8 cols */}
              <div className="col-span-8">
                <div className="glass-card p-8 relative overflow-hidden">
                  {/* Spotlight Effect */}
                  <div className="absolute -top-1/2 left-1/2 -translate-x-1/2 w-full h-full bg-gradient-to-b from-blue-500/20 to-transparent rounded-full blur-3xl" />
                  
                  <div className="relative flex gap-8">
                    {/* Player Image */}
                    <div className="relative">
                      <img
                        src={currentPlayer.image_url || 'https://images.unsplash.com/photo-1583072728920-4ed8c72cbc01?w=400&h=500&fit=crop'}
                        alt={currentPlayer.name}
                        className="w-64 h-80 object-cover rounded-2xl shadow-2xl"
                      />
                      <div className="absolute -bottom-4 -right-4 bg-blue-600 px-4 py-2 rounded-xl shadow-lg">
                        <span className="text-white font-bold uppercase text-sm">{currentPlayer.role}</span>
                      </div>
                    </div>
                    
                    {/* Player Info */}
                    <div className="flex-1 flex flex-col justify-center">
                      <span className="text-green-400 text-sm font-bold uppercase tracking-widest mb-2">
                        Now Bidding
                      </span>
                      <h2 className="font-heading text-5xl font-black text-white tracking-tight mb-4">
                        {currentPlayer.name}
                      </h2>
                      
                      {/* Stats */}
                      {(currentPlayer.matches > 0 || currentPlayer.runs > 0 || currentPlayer.wickets > 0) && (
                        <div className="flex gap-6 mb-8">
                          <div className="text-center">
                            <p className="font-mono text-3xl font-bold text-white">{currentPlayer.matches || 0}</p>
                            <p className="text-xs text-slate-500 uppercase tracking-wider">Matches</p>
                          </div>
                          <div className="text-center">
                            <p className="font-mono text-3xl font-bold text-white">{currentPlayer.runs || 0}</p>
                            <p className="text-xs text-slate-500 uppercase tracking-wider">Runs</p>
                          </div>
                          <div className="text-center">
                            <p className="font-mono text-3xl font-bold text-white">{currentPlayer.wickets || 0}</p>
                            <p className="text-xs text-slate-500 uppercase tracking-wider">Wickets</p>
                          </div>
                        </div>
                      )}
                      
                      {/* Current Bid */}
                      <div className="bg-gradient-to-r from-green-500/20 to-green-500/5 border border-green-500/30 rounded-2xl p-6">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="w-5 h-5 text-green-400" />
                          <span className="text-green-400 text-sm font-bold uppercase tracking-wider">Current Bid</span>
                        </div>
                        <p className="font-mono text-6xl font-black text-green-400">
                          {formatPrice(auction.current_bid)}
                        </p>
                        {auction.current_bidder_name && (
                          <p className="text-white text-xl mt-2">
                            by <span className="font-bold text-blue-400">{auction.current_bidder_name}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bid History */}
                {auction.bid_history?.length > 0 && (
                  <div className="glass-card p-6 mt-6">
                    <h3 className="font-heading text-lg text-white mb-4 flex items-center gap-2">
                      <Gavel className="w-5 h-5 text-blue-400" />
                      Bid History
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {[...auction.bid_history].reverse().slice(0, 10).map((bid, index) => (
                        <div 
                          key={index}
                          className={`px-4 py-2 rounded-full text-sm font-mono ${
                            index === 0 
                              ? 'bg-green-500/20 text-green-400 border border-green-500/50' 
                              : 'bg-slate-800/50 text-slate-400'
                          }`}
                        >
                          <span className="font-bold">{bid.team_short_name || bid.team_name}</span>
                          <span className="mx-2">•</span>
                          <span>{formatPrice(bid.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Teams Sidebar - 4 cols */}
              <div className="col-span-4">
                <div className="glass-card p-6 sticky top-8">
                  <h3 className="font-heading text-lg text-white mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-400" />
                    Teams
                  </h3>
                  <div className="space-y-3">
                    {teams.map((team) => (
                      <div 
                        key={team.team_id}
                        className={`p-4 rounded-xl transition-all ${
                          auction.current_bidder_id === team.team_id
                            ? 'bg-green-500/20 border-2 border-green-500 scale-105'
                            : 'bg-slate-800/50 border border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`font-bold text-lg ${
                            auction.current_bidder_id === team.team_id ? 'text-green-400' : 'text-white'
                          }`}>
                            {team.short_name || team.name}
                          </span>
                          <span className="font-mono text-green-400">{formatPrice(team.remaining_budget)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Users className="w-3 h-3" />
                          <span>{team.players?.length || 0} players</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Waiting Screen */
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center">
                <div className="w-32 h-32 rounded-full bg-slate-800/50 flex items-center justify-center mx-auto mb-8 animate-pulse">
                  <Gavel className="w-16 h-16 text-slate-600" />
                </div>
                <h2 className="font-heading text-4xl font-bold text-white mb-4">
                  {isLive ? 'Waiting for Next Player...' : 'Auction Not Started'}
                </h2>
                <p className="text-slate-400 text-lg">
                  {isLive ? 'The auctioneer will bring up the next player shortly' : 'Stay tuned for the auction to begin'}
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Sold/Unsold Overlay - shown briefly when player is sold */}
      {/* This would need WebSocket for instant display, using CSS animation for now */}
      <style>{`
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(34, 197, 94, 0.4); }
          50% { box-shadow: 0 0 60px rgba(34, 197, 94, 0.8); }
        }
        .animate-pulse-glow {
          animation: pulse-glow 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default AuctionViewScreen;
