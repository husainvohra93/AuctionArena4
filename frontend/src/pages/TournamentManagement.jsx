import React, { useState, useEffect } from 'react';
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
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Pencil, Trash2, Trophy, Calendar, Gavel } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TournamentManagement = () => {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTournament, setEditingTournament] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: ''
  });

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      const response = await axios.get(`${API}/tournaments`, { withCredentials: true });
      setTournaments(response.data);
    } catch (error) {
      toast.error('Failed to fetch tournaments');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingTournament) {
        await axios.put(`${API}/tournaments/${editingTournament.tournament_id}`, formData, { withCredentials: true });
        toast.success('Tournament updated successfully');
      } else {
        await axios.post(`${API}/tournaments`, formData, { withCredentials: true });
        toast.success('Tournament created successfully');
      }
      
      setDialogOpen(false);
      resetForm();
      fetchTournaments();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Operation failed');
    }
  };

  const handleEdit = (tournament) => {
    setEditingTournament(tournament);
    setFormData({
      name: tournament.name,
      description: tournament.description || '',
      start_date: tournament.start_date || '',
      end_date: tournament.end_date || ''
    });
    setDialogOpen(true);
  };

  const handleDelete = async (tournamentId) => {
    if (!window.confirm('Are you sure? This will delete all auctions in this tournament.')) return;
    
    try {
      await axios.delete(`${API}/tournaments/${tournamentId}`, { withCredentials: true });
      toast.success('Tournament deleted');
      fetchTournaments();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Delete failed');
    }
  };

  const resetForm = () => {
    setEditingTournament(null);
    setFormData({
      name: '',
      description: '',
      start_date: '',
      end_date: ''
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <span className="bg-green-500/20 text-green-400 border border-green-500/50 px-3 py-1 rounded-full text-xs font-bold uppercase">Active</span>;
      case 'completed':
        return <span className="bg-slate-500/20 text-slate-400 border border-slate-500/50 px-3 py-1 rounded-full text-xs font-bold uppercase">Completed</span>;
      default:
        return <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 px-3 py-1 rounded-full text-xs font-bold uppercase">Draft</span>;
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
              <h1 className="font-heading text-3xl font-bold text-white tracking-tight">Tournaments</h1>
              <p className="text-slate-400 mt-1">Manage your cricket tournaments</p>
            </div>
            
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button data-testid="add-tournament-btn" className="btn-primary flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  New Tournament
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-700">
                <DialogHeader>
                  <DialogTitle className="font-heading text-white">
                    {editingTournament ? 'Edit Tournament' : 'Create Tournament'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                  <div>
                    <Label className="text-slate-300">Tournament Name *</Label>
                    <Input
                      data-testid="tournament-name-input"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      placeholder="Premier League 2025"
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Description</Label>
                    <Input
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Annual cricket tournament..."
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-300">Start Date</Label>
                      <Input
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                        className="bg-slate-800 border-slate-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">End Date</Label>
                      <Input
                        type="date"
                        value={formData.end_date}
                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                        className="bg-slate-800 border-slate-700 text-white"
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="border-slate-700 text-slate-300">
                      Cancel
                    </Button>
                    <Button type="submit" data-testid="save-tournament-btn" className="btn-primary">
                      {editingTournament ? 'Update' : 'Create'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Tournaments Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tournaments.map((tournament, index) => (
              <Card 
                key={tournament.tournament_id}
                data-testid={`tournament-card-${tournament.tournament_id}`}
                className="glass-card border-0 card-hover animate-fade-in-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                      <Trophy className="w-6 h-6 text-yellow-400" />
                    </div>
                    {getStatusBadge(tournament.status)}
                  </div>
                  
                  <h3 className="font-heading font-bold text-white text-xl mb-2">{tournament.name}</h3>
                  {tournament.description && (
                    <p className="text-slate-400 text-sm mb-4 line-clamp-2">{tournament.description}</p>
                  )}
                  
                  {(tournament.start_date || tournament.end_date) && (
                    <div className="flex items-center gap-2 text-slate-500 text-sm mb-4">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {tournament.start_date || 'TBD'} - {tournament.end_date || 'TBD'}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex gap-2 mt-4">
                    <Button
                      size="sm"
                      onClick={() => navigate(`/admin/tournaments/${tournament.tournament_id}/auctions`)}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 text-white"
                    >
                      <Gavel className="w-3 h-3 mr-1" />
                      Auctions
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(tournament)}
                      className="border-slate-700 text-slate-300 hover:bg-slate-800"
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(tournament.tournament_id)}
                      className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {tournaments.length === 0 && (
            <div className="text-center py-12">
              <Trophy className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-500 text-lg">No tournaments yet</p>
              <p className="text-slate-600 text-sm mt-2">Create your first tournament to get started</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default TournamentManagement;
