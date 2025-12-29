import React, { useState, useEffect, useRef } from 'react';
import Layout from '@/components/Layout';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Pencil, Trash2, Gavel, Play, Calendar, Users, ArrowLeft, Download, Upload, FileSpreadsheet } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AuctionManagement = () => {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAuction, setEditingAuction] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    players_per_team: 15,
    bid_increment_rules: [
      { range_start: 0, increment_by: 100 },
      { range_start: 1000, increment_by: 200 },
      { range_start: 2000, increment_by: 500 }
    ]
  });

  useEffect(() => {
    fetchData();
  }, [tournamentId]);

  const fetchData = async () => {
    try {
      const [tournamentRes, auctionsRes] = await Promise.all([
        axios.get(`${API}/tournaments/${tournamentId}`, { withCredentials: true }),
        axios.get(`${API}/auctions?tournament_id=${tournamentId}`, { withCredentials: true })
      ]);
      setTournament(tournamentRes.data);
      setAuctions(auctionsRes.data);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        tournament_id: tournamentId,
        players_per_team: parseInt(formData.players_per_team)
      };

      if (editingAuction) {
        await axios.put(`${API}/auctions/${editingAuction.auction_id}`, payload, { withCredentials: true });
        toast.success('Auction updated successfully');
      } else {
        await axios.post(`${API}/auctions`, payload, { withCredentials: true });
        toast.success('Auction created successfully');
      }
      
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Operation failed');
    }
  };

  const handleEdit = (auction) => {
    setEditingAuction(auction);
    setFormData({
      name: auction.name,
      date: auction.date || '',
      players_per_team: auction.players_per_team || 15,
      bid_increment_rules: auction.bid_increment_rules?.length > 0 
        ? auction.bid_increment_rules 
        : [{ range_start: 0, increment_by: 100 }]
    });
    setDialogOpen(true);
  };

  const handleDelete = async (auctionId) => {
    if (!window.confirm('Are you sure you want to delete this auction?')) return;
    
    try {
      await axios.delete(`${API}/auctions/${auctionId}`, { withCredentials: true });
      toast.success('Auction deleted');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Delete failed');
    }
  };

  const resetForm = () => {
    setEditingAuction(null);
    setFormData({
      name: '',
      date: '',
      players_per_team: 15,
      bid_increment_rules: [
        { range_start: 0, increment_by: 100 },
        { range_start: 1000, increment_by: 200 },
        { range_start: 2000, increment_by: 500 }
      ]
    });
  };

  const addBidRule = () => {
    setFormData({
      ...formData,
      bid_increment_rules: [
        ...formData.bid_increment_rules,
        { range_start: 0, increment_by: 100 }
      ]
    });
  };

  const removeBidRule = (index) => {
    const rules = [...formData.bid_increment_rules];
    rules.splice(index, 1);
    setFormData({ ...formData, bid_increment_rules: rules });
  };

  const updateBidRule = (index, field, value) => {
    const rules = [...formData.bid_increment_rules];
    rules[index][field] = parseFloat(value) || 0;
    setFormData({ ...formData, bid_increment_rules: rules });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'live':
        return <span className="bg-green-500/20 text-green-400 border border-green-500/50 px-3 py-1 rounded-full text-xs font-bold uppercase animate-pulse">Live</span>;
      case 'paused':
        return <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 px-3 py-1 rounded-full text-xs font-bold uppercase">Paused</span>;
      case 'completed':
        return <span className="bg-slate-500/20 text-slate-400 border border-slate-500/50 px-3 py-1 rounded-full text-xs font-bold uppercase">Completed</span>;
      default:
        return <span className="bg-blue-500/20 text-blue-400 border border-blue-500/50 px-3 py-1 rounded-full text-xs font-bold uppercase">Draft</span>;
    }
  };

  // File upload refs
  const teamsFileRef = useRef(null);
  const playersFileRef = useRef(null);

  const handleTeamsUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await axios.post(`${API}/import/teams/${tournamentId}`, formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(response.data.message);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to import teams');
    }
    e.target.value = '';
  };

  const handlePlayersUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await axios.post(`${API}/import/players/${tournamentId}`, formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(response.data.message);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to import players');
    }
    e.target.value = '';
  };

  const downloadTemplate = (type) => {
    window.open(`${API}/export/${type}-template`, '_blank');
  };

  const exportData = (type) => {
    window.open(`${API}/export/${type}/${tournamentId}`, '_blank');
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
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => navigate('/admin/tournaments')}
            className="text-slate-400 hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Tournaments
          </Button>

          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="font-heading text-3xl font-bold text-white tracking-tight">
                {tournament?.name} - Auctions
              </h1>
              <p className="text-slate-400 mt-1">Configure and manage auctions for this tournament</p>
            </div>
            
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button data-testid="add-auction-btn" className="btn-primary flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  New Auction
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="font-heading text-white">
                    {editingAuction ? 'Edit Auction' : 'Create Auction'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-300">Auction Name *</Label>
                      <Input
                        data-testid="auction-name-input"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        placeholder="Main Auction"
                        className="bg-slate-800 border-slate-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">Date</Label>
                      <Input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="bg-slate-800 border-slate-700 text-white"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-slate-300">Players Per Team Limit</Label>
                    <Input
                      type="number"
                      value={formData.players_per_team}
                      onChange={(e) => setFormData({ ...formData, players_per_team: e.target.value })}
                      min={1}
                      max={25}
                      className="bg-slate-800 border-slate-700 text-white w-32"
                    />
                  </div>

                  {/* Bid Increment Rules */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-slate-300">Bid Increment Rules</Label>
                      <Button type="button" size="sm" variant="outline" onClick={addBidRule} className="border-slate-700 text-slate-300">
                        <Plus className="w-3 h-3 mr-1" /> Add Rule
                      </Button>
                    </div>
                    <p className="text-xs text-slate-500 mb-4">
                      Define how bid increment changes based on current bid amount
                    </p>
                    
                    <div className="space-y-3">
                      {formData.bid_increment_rules.map((rule, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
                          <div className="flex-1">
                            <Label className="text-xs text-slate-500">When bid reaches</Label>
                            <Input
                              type="number"
                              value={rule.range_start}
                              onChange={(e) => updateBidRule(index, 'range_start', e.target.value)}
                              className="bg-slate-800 border-slate-700 text-white h-9"
                              placeholder="1000"
                            />
                          </div>
                          <div className="flex-1">
                            <Label className="text-xs text-slate-500">Increment by</Label>
                            <Input
                              type="number"
                              value={rule.increment_by}
                              onChange={(e) => updateBidRule(index, 'increment_by', e.target.value)}
                              className="bg-slate-800 border-slate-700 text-white h-9"
                              placeholder="100"
                            />
                          </div>
                          {formData.bid_increment_rules.length > 1 && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => removeBidRule(index)}
                              className="text-red-400 hover:text-red-300 mt-5"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="border-slate-700 text-slate-300">
                      Cancel
                    </Button>
                    <Button type="submit" data-testid="save-auction-btn" className="btn-primary">
                      {editingAuction ? 'Update' : 'Create'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Quick Links */}
          <div className="flex flex-wrap gap-4 mb-8">
            <Button
              variant="outline"
              onClick={() => navigate(`/admin/players?tournament=${tournamentId}`)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              <Users className="w-4 h-4 mr-2" />
              Manage Players
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/admin/teams?tournament=${tournamentId}`)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              <Users className="w-4 h-4 mr-2" />
              Manage Teams
            </Button>
          </div>

          {/* Import/Export Section */}
          <Card className="glass-card border-0 mb-8">
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-white text-lg flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-green-400" />
                Import / Export Data
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Import */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-slate-300">Import (Upload Excel)</h4>
                  <div className="flex flex-wrap gap-2">
                    <input type="file" ref={teamsFileRef} onChange={handleTeamsUpload} accept=".xlsx,.xls" className="hidden" />
                    <Button size="sm" variant="outline" onClick={() => teamsFileRef.current?.click()} className="border-green-500/50 text-green-400 hover:bg-green-500/10">
                      <Upload className="w-3 h-3 mr-1" /> Upload Teams
                    </Button>
                    <input type="file" ref={playersFileRef} onChange={handlePlayersUpload} accept=".xlsx,.xls" className="hidden" />
                    <Button size="sm" variant="outline" onClick={() => playersFileRef.current?.click()} className="border-green-500/50 text-green-400 hover:bg-green-500/10">
                      <Upload className="w-3 h-3 mr-1" /> Upload Players
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" onClick={() => downloadTemplate('teams')} className="text-slate-400 hover:text-white text-xs">
                      <Download className="w-3 h-3 mr-1" /> Teams Template
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => downloadTemplate('players')} className="text-slate-400 hover:text-white text-xs">
                      <Download className="w-3 h-3 mr-1" /> Players Template
                    </Button>
                  </div>
                </div>
                
                {/* Export */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-slate-300">Export (Download Excel)</h4>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => exportData('teams')} className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10">
                      <Download className="w-3 h-3 mr-1" /> Teams & Wallet
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => exportData('players')} className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10">
                      <Download className="w-3 h-3 mr-1" /> All Players
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => exportData('auction-results')} className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10">
                      <Download className="w-3 h-3 mr-1" /> Auction Results
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Auctions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {auctions.map((auction, index) => (
              <Card 
                key={auction.auction_id}
                data-testid={`auction-card-${auction.auction_id}`}
                className="glass-card border-0 card-hover animate-fade-in-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                      <Gavel className="w-6 h-6 text-blue-400" />
                    </div>
                    {getStatusBadge(auction.status)}
                  </div>
                  
                  <h3 className="font-heading font-bold text-white text-xl mb-2">{auction.name}</h3>
                  
                  {auction.date && (
                    <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
                      <Calendar className="w-4 h-4" />
                      <span>{auction.date}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 text-slate-500 text-sm mb-4">
                    <Users className="w-4 h-4" />
                    <span>Max {auction.players_per_team} players/team</span>
                  </div>

                  {auction.bid_increment_rules?.length > 0 && (
                    <div className="mb-4 p-3 bg-slate-800/30 rounded-lg">
                      <p className="text-xs text-slate-500 uppercase mb-2">Bid Increments</p>
                      <div className="space-y-1">
                        {auction.bid_increment_rules.slice(0, 3).map((rule, i) => (
                          <p key={i} className="text-xs text-slate-400">
                            At ₹{rule.range_start?.toLocaleString()} → +₹{rule.increment_by?.toLocaleString()}
                          </p>
                        ))}
                        {auction.bid_increment_rules.length > 3 && (
                          <p className="text-xs text-slate-500">+{auction.bid_increment_rules.length - 3} more rules</p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => navigate(`/admin/auction/${auction.auction_id}/control`)}
                      className="flex-1 bg-green-600 hover:bg-green-500 text-white"
                    >
                      <Play className="w-3 h-3 mr-1" />
                      Control
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(auction)}
                      className="border-slate-700 text-slate-300 hover:bg-slate-800"
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(auction.auction_id)}
                      className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {auctions.length === 0 && (
            <div className="text-center py-12">
              <Gavel className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-500 text-lg">No auctions configured</p>
              <p className="text-slate-600 text-sm mt-2">Create an auction to start bidding</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default AuctionManagement;
