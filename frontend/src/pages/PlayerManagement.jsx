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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Pencil, Trash2, RotateCcw, Search, Filter, Upload, CheckSquare, Square } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PlayerManagement = () => {
  const [players, setPlayers] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [tournamentFilter, setTournamentFilter] = useState('all');
  const [uploading, setUploading] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    role: 'batsman',
    base_price: 100000,
    image_url: '',
    age: '',
    batting_style: '',
    bowling_style: '',
    matches: 0,
    runs: 0,
    wickets: 0,
    tournament_id: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [playersRes, tournamentsRes] = await Promise.all([
        axios.get(`${API}/players`, { withCredentials: true }),
        axios.get(`${API}/tournaments`, { withCredentials: true })
      ]);
      setPlayers(playersRes.data);
      setTournaments(tournamentsRes.data);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const fetchPlayers = async () => {
    try {
      const response = await axios.get(`${API}/players`, { withCredentials: true });
      setPlayers(response.data);
    } catch (error) {
      toast.error('Failed to fetch players');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        base_price: parseFloat(formData.base_price),
        age: formData.age ? parseInt(formData.age) : null,
        matches: parseInt(formData.matches) || 0,
        runs: parseInt(formData.runs) || 0,
        wickets: parseInt(formData.wickets) || 0,
        tournament_id: formData.tournament_id || null
      };

      if (editingPlayer) {
        await axios.put(`${API}/players/${editingPlayer.player_id}`, payload, { withCredentials: true });
        toast.success('Player updated successfully');
      } else {
        await axios.post(`${API}/players`, payload, { withCredentials: true });
        toast.success('Player added successfully');
      }

      setDialogOpen(false);
      resetForm();
      fetchPlayers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Operation failed');
    }
  };

  const handleEdit = (player) => {
    setEditingPlayer(player);
    setFormData({
      name: player.name,
      role: player.role,
      base_price: player.base_price,
      image_url: player.image_url || '',
      age: player.age || '',
      batting_style: player.batting_style || '',
      bowling_style: player.bowling_style || '',
      matches: player.matches || 0,
      runs: player.runs || 0,
      wickets: player.wickets || 0,
      tournament_id: player.tournament_id || ''
    });
    setDialogOpen(true);
  };

  const handleDelete = async (playerId) => {
    if (!window.confirm('Are you sure you want to delete this player?')) return;

    try {
      await axios.delete(`${API}/players/${playerId}`, { withCredentials: true });
      toast.success('Player deleted successfully');
      fetchPlayers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Delete failed');
    }
  };

  const handleBulkDelete = async () => {
    try {
      await axios.post(`${API}/players/bulk-delete`, { ids: selectedPlayers }, { withCredentials: true });
      toast.success(`Deleted ${selectedPlayers.length} players`);
      setSelectedPlayers([]);
      setBulkDeleteDialogOpen(false);
      fetchPlayers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Bulk delete failed');
    }
  };

  const toggleSelectPlayer = (playerId) => {
    setSelectedPlayers(prev =>
      prev.includes(playerId)
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedPlayers.length === filteredPlayers.length) {
      setSelectedPlayers([]);
    } else {
      setSelectedPlayers(filteredPlayers.map(p => p.player_id));
    }
  };

  const handleReset = async (playerId) => {
    try {
      await axios.post(`${API}/players/${playerId}/reset`, {}, { withCredentials: true });
      toast.success('Player reset to unsold');
      fetchPlayers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Reset failed');
    }
  };

  const resetForm = () => {
    setEditingPlayer(null);
    setFormData({
      name: '',
      role: 'batsman',
      base_price: 100000,
      image_url: '',
      age: '',
      batting_style: '',
      bowling_style: '',
      matches: 0,
      runs: 0,
      wickets: 0,
      tournament_id: ''
    });
  };

  const getTournamentName = (tournamentId) => {
    const tournament = tournaments.find(t => t.tournament_id === tournamentId);
    return tournament?.name || 'Not Assigned';
  };

  const formatPrice = (price) => {
    if (price >= 10000000) return `${(price / 10000000).toFixed(2)} Cr Pts`;
    if (price >= 100000) return `${(price / 100000).toFixed(2)} L Pts`;
    return `${price?.toLocaleString()} Pts`;
  };

  const filteredPlayers = players.filter(player => {
    const matchesSearch = player.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || player.status === statusFilter;
    const matchesRole = roleFilter === 'all' || player.role === roleFilter;
    const matchesTournament = tournamentFilter === 'all' || player.tournament_id === tournamentFilter;
    return matchesSearch && matchesStatus && matchesRole && matchesTournament;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'sold':
        return <span className="badge-sold">Sold</span>;
      case 'in_auction':
        return <span className="badge-in-auction">In Auction</span>;
      default:
        return <span className="badge-unsold">Unsold</span>;
    }
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
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="font-heading text-3xl font-bold text-white tracking-tight">Player Management</h1>
              <p className="text-slate-400 mt-1">{players.length} players registered</p>
            </div>

            <div className="flex gap-2">
              {selectedPlayers.length > 0 && (
                <Button
                  variant="destructive"
                  onClick={() => setBulkDeleteDialogOpen(true)}
                  className="bg-red-600 hover:bg-red-500"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete ({selectedPlayers.length})
                </Button>
              )}

              <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button data-testid="add-player-btn" className="btn-primary flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Add Player
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="font-heading text-white">
                      {editingPlayer ? 'Edit Player' : 'Add New Player'}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-slate-300">Name *</Label>
                        <Input
                          data-testid="player-name-input"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          required
                          className="bg-slate-800 border-slate-700 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-slate-300">Role *</Label>
                        <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                          <SelectTrigger data-testid="player-role-select" className="bg-slate-800 border-slate-700 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-700">
                            <SelectItem value="batsman">Batsman</SelectItem>
                            <SelectItem value="bowler">Bowler</SelectItem>
                            <SelectItem value="all-rounder">All-Rounder</SelectItem>
                            <SelectItem value="wicket-keeper">Wicket-Keeper</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-slate-300">Base Price (Points) *</Label>
                        <Input
                          data-testid="player-base-price-input"
                          type="number"
                          value={formData.base_price}
                          onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                          required
                          className="bg-slate-800 border-slate-700 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-slate-300">Tournament *</Label>
                        <Select value={formData.tournament_id} onValueChange={(v) => setFormData({ ...formData, tournament_id: v })}>
                          <SelectTrigger data-testid="player-tournament-select" className="bg-slate-800 border-slate-700 text-white">
                            <SelectValue placeholder="Select Tournament" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-700">
                            {tournaments.map((t) => (
                              <SelectItem key={t.tournament_id} value={t.tournament_id}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-slate-300">Age</Label>
                        <Input
                          type="number"
                          value={formData.age}
                          onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                          className="bg-slate-800 border-slate-700 text-white"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-slate-300">Player Image</Label>
                        <div className="flex gap-2 mt-1">
                          <Input
                            data-testid="player-image-input"
                            value={formData.image_url}
                            onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                            placeholder="Paste URL or click Upload"
                            className="bg-slate-800 border-slate-700 text-white flex-1"
                          />
                          <input
                            type="file"
                            ref={fileInputRef}
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files[0];
                              if (!file) return;

                              setUploading(true);
                              const uploadData = new FormData();
                              uploadData.append('file', file);

                              try {
                                const res = await axios.post(`${API}/upload/image`, uploadData, {
                                  withCredentials: true,
                                  headers: { 'Content-Type': 'multipart/form-data' }
                                });
                                setFormData(prev => ({
                                  ...prev,
                                  image_url: res.data.url.startsWith('http') ? res.data.url : `${BACKEND_URL}${res.data.url}`
                                }));
                                toast.success('Image uploaded!');
                              } catch (err) {
                                toast.error(err.response?.data?.detail || 'Upload failed');
                              } finally {
                                setUploading(false);
                              }
                              e.target.value = '';
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="border-slate-700 text-slate-300 hover:bg-slate-800"
                            disabled={uploading}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Upload className="w-4 h-4 mr-1" />
                            {uploading ? 'Uploading...' : 'Upload'}
                          </Button>
                        </div>
                        {formData.image_url && (
                          <div className="mt-2 flex items-center gap-2">
                            <img src={formData.image_url} alt="Preview" className="w-16 h-16 rounded object-cover" onError={(e) => e.target.style.display = 'none'} />
                            <span className="text-xs text-slate-500 truncate flex-1">{formData.image_url}</span>
                          </div>
                        )}
                      </div>
                      <div>
                        <Label className="text-slate-300">Batting Style</Label>
                        <Select value={formData.batting_style} onValueChange={(v) => setFormData({ ...formData, batting_style: v })}>
                          <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-700">
                            <SelectItem value="right-handed">Right-Handed</SelectItem>
                            <SelectItem value="left-handed">Left-Handed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-slate-300">Bowling Style</Label>
                        <Select value={formData.bowling_style} onValueChange={(v) => setFormData({ ...formData, bowling_style: v })}>
                          <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-700">
                            <SelectItem value="right-arm-fast">Right-Arm Fast</SelectItem>
                            <SelectItem value="left-arm-fast">Left-Arm Fast</SelectItem>
                            <SelectItem value="right-arm-spin">Right-Arm Spin</SelectItem>
                            <SelectItem value="left-arm-spin">Left-Arm Spin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-slate-300">Matches</Label>
                        <Input
                          type="number"
                          value={formData.matches}
                          onChange={(e) => setFormData({ ...formData, matches: e.target.value })}
                          className="bg-slate-800 border-slate-700 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-slate-300">Runs</Label>
                        <Input
                          type="number"
                          value={formData.runs}
                          onChange={(e) => setFormData({ ...formData, runs: e.target.value })}
                          className="bg-slate-800 border-slate-700 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-slate-300">Wickets</Label>
                        <Input
                          type="number"
                          value={formData.wickets}
                          onChange={(e) => setFormData({ ...formData, wickets: e.target.value })}
                          className="bg-slate-800 border-slate-700 text-white"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="border-slate-700 text-slate-300">
                        Cancel
                      </Button>
                      <Button type="submit" data-testid="save-player-btn" className="btn-primary">
                        {editingPlayer ? 'Update' : 'Add'} Player
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Filters */}
          <Card className="glass-card border-0 mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    data-testid="search-players-input"
                    placeholder="Search players..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px] bg-slate-800 border-slate-700 text-white">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="unsold">Unsold</SelectItem>
                    <SelectItem value="sold">Sold</SelectItem>
                    <SelectItem value="in_auction">In Auction</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-[150px] bg-slate-800 border-slate-700 text-white">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="batsman">Batsman</SelectItem>
                    <SelectItem value="bowler">Bowler</SelectItem>
                    <SelectItem value="all-rounder">All-Rounder</SelectItem>
                    <SelectItem value="wicket-keeper">Wicket-Keeper</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={tournamentFilter} onValueChange={setTournamentFilter}>
                  <SelectTrigger className="w-[180px] bg-slate-800 border-slate-700 text-white">
                    <SelectValue placeholder="Tournament" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="all">All Tournaments</SelectItem>
                    {tournaments.map((t) => (
                      <SelectItem key={t.tournament_id} value={t.tournament_id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Players Grid */}
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSelectAll}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              {selectedPlayers.length === filteredPlayers.length && filteredPlayers.length > 0 ? (
                <>
                  <CheckSquare className="w-4 h-4 mr-2" />
                  Deselect All
                </>
              ) : (
                <>
                  <Square className="w-4 h-4 mr-2" />
                  Select All ({filteredPlayers.length})
                </>
              )}
            </Button>
            {selectedPlayers.length > 0 && (
              <span className="text-sm text-slate-400">{selectedPlayers.length} selected</span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredPlayers.map((player, index) => (
              <Card
                key={player.player_id}
                data-testid={`player-card-${player.player_id}`}
                className={`glass-card border-0 card-hover animate-fade-in-up ${selectedPlayers.includes(player.player_id) ? 'ring-2 ring-blue-500' : ''}`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <CardContent className="p-4">
                  <div className="relative mb-4">
                    {/* Checkbox */}
                    <div
                      className="absolute top-2 left-2 z-10 cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); toggleSelectPlayer(player.player_id); }}
                    >
                      <Checkbox
                        checked={selectedPlayers.includes(player.player_id)}
                        className="bg-slate-800 border-slate-600 data-[state=checked]:bg-blue-500"
                      />
                    </div>
                    <img
                      src={player.image_url || 'https://images.unsplash.com/photo-1583072728920-4ed8c72cbc01?w=300&h=400&fit=crop'}
                      alt={player.name}
                      className="player-image"
                    />
                    <div className="absolute top-2 right-2">
                      {getStatusBadge(player.status)}
                    </div>
                  </div>

                  <h3 className="font-heading font-bold text-white text-lg truncate">{player.name}</h3>
                  <div className="flex items-center gap-2 mt-1 mb-2">
                    <span className="badge-role">{player.role}</span>
                    {player.age && <span className="text-xs text-slate-500">{player.age} yrs</span>}
                  </div>
                  {player.tournament_id && (
                    <p className="text-xs text-blue-400 mb-3 truncate">🏆 {getTournamentName(player.tournament_id)}</p>
                  )}

                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <p className="text-xs text-slate-500 uppercase">Base Price</p>
                      <p className="font-mono font-bold text-white">{formatPrice(player.base_price)}</p>
                    </div>
                    {player.status === 'sold' && (
                      <div className="text-right">
                        <p className="text-xs text-slate-500 uppercase">Sold For</p>
                        <p className="font-mono font-bold text-green-400">{formatPrice(player.sold_price)}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(player)}
                      className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                    >
                      <Pencil className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                    {player.status === 'sold' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReset(player.player_id)}
                        className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(player.player_id)}
                      className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredPlayers.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <p>No players found</p>
            </div>
          )}
        </div>
      </div>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete {selectedPlayers.length} Players?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Are you sure you want to delete {selectedPlayers.length} selected players? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 border-slate-700 text-slate-300">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-500">
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default PlayerManagement;
