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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Pencil, Trash2, Users, UserPlus, Upload, Coins, CheckSquare, Square } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TeamManagement = () => {
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [tournamentFilter, setTournamentFilter] = useState('all');
  const [uploading, setUploading] = useState(false);
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    short_name: '',
    logo_url: '',
    budget: 10000000,
    owner_email: '',
    tournament_id: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [teamsRes, usersRes, tournamentsRes] = await Promise.all([
        axios.get(`${API}/teams`, { withCredentials: true }),
        axios.get(`${API}/users`, { withCredentials: true }),
        axios.get(`${API}/tournaments`, { withCredentials: true })
      ]);
      setTeams(teamsRes.data);
      setUsers(usersRes.data);
      setTournaments(tournamentsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        budget: parseFloat(formData.budget),
        tournament_id: formData.tournament_id || null
      };

      if (editingTeam) {
        await axios.put(`${API}/teams/${editingTeam.team_id}`, payload, { withCredentials: true });
        toast.success('Team updated successfully');
      } else {
        await axios.post(`${API}/teams`, payload, { withCredentials: true });
        toast.success('Team created successfully');
      }
      
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Operation failed');
    }
  };

  const handleEdit = (team) => {
    setEditingTeam(team);
    setFormData({
      name: team.name,
      short_name: team.short_name,
      logo_url: team.logo_url || '',
      budget: team.budget,
      owner_email: team.owner_email || '',
      tournament_id: team.tournament_id || ''
    });
    setDialogOpen(true);
  };

  const handleDelete = async (teamId) => {
    if (!window.confirm('Are you sure you want to delete this team?')) return;
    
    try {
      await axios.delete(`${API}/teams/${teamId}`, { withCredentials: true });
      toast.success('Team deleted successfully');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Delete failed');
    }
  };

  const handleBulkDelete = async () => {
    try {
      await axios.post(`${API}/teams/bulk-delete`, { ids: selectedTeams }, { withCredentials: true });
      toast.success(`Deleted ${selectedTeams.length} teams`);
      setSelectedTeams([]);
      setBulkDeleteDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Bulk delete failed');
    }
  };

  const toggleSelectTeam = (teamId) => {
    setSelectedTeams(prev => 
      prev.includes(teamId) 
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedTeams.length === filteredTeams.length) {
      setSelectedTeams([]);
    } else {
      setSelectedTeams(filteredTeams.map(t => t.team_id));
    }
  };

  const handleAssignTeam = async () => {
    if (!selectedUser || !editingTeam) return;
    
    try {
      await axios.put(`${API}/users/${selectedUser}/team`, 
        { team_id: editingTeam.team_id },
        { withCredentials: true }
      );
      toast.success('Team owner assigned successfully');
      setAssignDialogOpen(false);
      setSelectedUser(null);
      setEditingTeam(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Assignment failed');
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    try {
      await axios.put(`${API}/users/${userId}/role`, 
        { role: newRole },
        { withCredentials: true }
      );
      toast.success('User role updated');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Update failed');
    }
  };

  const resetForm = () => {
    setEditingTeam(null);
    setFormData({
      name: '',
      short_name: '',
      logo_url: '',
      budget: 10000000,
      owner_email: '',
      tournament_id: ''
    });
  };

  const formatPrice = (price) => {
    if (price >= 10000000) return `${(price / 10000000).toFixed(2)} Cr Pts`;
    if (price >= 100000) return `${(price / 100000).toFixed(2)} L Pts`;
    return `${price?.toLocaleString()} Pts`;
  };

  const getTournamentName = (tournamentId) => {
    const tournament = tournaments.find(t => t.tournament_id === tournamentId);
    return tournament?.name || 'Not Assigned';
  };

  const filteredTeams = teams.filter(team => {
    return tournamentFilter === 'all' || team.tournament_id === tournamentFilter;
  });

  const teamOwners = users.filter(u => u.role === 'team_owner' && !u.team_id);

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
              <h1 className="font-heading text-3xl font-bold text-white tracking-tight">Team Management</h1>
              <p className="text-slate-400 mt-1">{teams.length} teams registered</p>
            </div>
            
            <div className="flex gap-2">
              {selectedTeams.length > 0 && (
                <Button 
                  variant="destructive" 
                  onClick={() => setBulkDeleteDialogOpen(true)}
                  className="bg-red-600 hover:bg-red-500"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete ({selectedTeams.length})
                </Button>
              )}
              
              <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button data-testid="add-team-btn" className="btn-primary flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Add Team
                  </Button>
                </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-700">
                <DialogHeader>
                  <DialogTitle className="font-heading text-white">
                    {editingTeam ? 'Edit Team' : 'Add New Team'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                  <div>
                    <Label className="text-slate-300">Team Name *</Label>
                    <Input
                      data-testid="team-name-input"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      placeholder="Mumbai Indians"
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Short Name *</Label>
                    <Input
                      data-testid="team-short-name-input"
                      value={formData.short_name}
                      onChange={(e) => setFormData({ ...formData, short_name: e.target.value.toUpperCase() })}
                      required
                      placeholder="MI"
                      maxLength={4}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-slate-300">Team Logo</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        value={formData.logo_url}
                        onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                        placeholder="https://... or upload below"
                        className="bg-slate-800 border-slate-700 text-white flex-1"
                      />
                      <label className="cursor-pointer">
                        <input
                          type="file"
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
                              setFormData({ ...formData, logo_url: `${BACKEND_URL}${res.data.url}` });
                              toast.success('Logo uploaded!');
                            } catch (err) {
                              toast.error(err.response?.data?.detail || 'Upload failed');
                            } finally {
                              setUploading(false);
                            }
                            e.target.value = '';
                          }}
                        />
                        <Button type="button" variant="outline" className="border-slate-700 text-slate-300" disabled={uploading}>
                          <Upload className="w-4 h-4 mr-1" />
                          {uploading ? '...' : 'Upload'}
                        </Button>
                      </label>
                    </div>
                    {formData.logo_url && (
                      <div className="mt-2 flex items-center gap-2">
                        <img src={formData.logo_url} alt="Preview" className="w-12 h-12 rounded object-cover" />
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-slate-300">Budget (Points) *</Label>
                    <Input
                      data-testid="team-budget-input"
                      type="number"
                      value={formData.budget}
                      onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                      required
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                    <p className="text-xs text-slate-500 mt-1">{formatPrice(parseFloat(formData.budget) || 0)}</p>
                  </div>
                  <div>
                    <Label className="text-slate-300">Tournament *</Label>
                    <Select value={formData.tournament_id} onValueChange={(v) => setFormData({ ...formData, tournament_id: v })}>
                      <SelectTrigger data-testid="team-tournament-select" className="bg-slate-800 border-slate-700 text-white">
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
                    <Label className="text-slate-300">Owner Email (Optional)</Label>
                    <Input
                      type="email"
                      value={formData.owner_email}
                      onChange={(e) => setFormData({ ...formData, owner_email: e.target.value })}
                      placeholder="owner@example.com"
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                  
                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="border-slate-700 text-slate-300">
                      Cancel
                    </Button>
                    <Button type="submit" data-testid="save-team-btn" className="btn-primary">
                      {editingTeam ? 'Update' : 'Create'} Team
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Tournament Filter */}
          <div className="mb-6">
            <Select value={tournamentFilter} onValueChange={setTournamentFilter}>
              <SelectTrigger className="w-[250px] bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Filter by Tournament" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">All Tournaments</SelectItem>
                {tournaments.map((t) => (
                  <SelectItem key={t.tournament_id} value={t.tournament_id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Select All Button */}
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSelectAll}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              {selectedTeams.length === filteredTeams.length && filteredTeams.length > 0 ? (
                <>
                  <CheckSquare className="w-4 h-4 mr-2" />
                  Deselect All
                </>
              ) : (
                <>
                  <Square className="w-4 h-4 mr-2" />
                  Select All ({filteredTeams.length})
                </>
              )}
            </Button>
            {selectedTeams.length > 0 && (
              <span className="text-sm text-slate-400">{selectedTeams.length} selected</span>
            )}
          </div>

          {/* Teams Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {filteredTeams.map((team, index) => (
              <Card 
                key={team.team_id}
                data-testid={`team-card-${team.team_id}`}
                className={`glass-card border-0 card-hover animate-fade-in-up ${selectedTeams.includes(team.team_id) ? 'ring-2 ring-blue-500' : ''}`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    {/* Checkbox */}
                    <div 
                      className="cursor-pointer mr-3 mt-1"
                      onClick={() => toggleSelectTeam(team.team_id)}
                    >
                      <Checkbox
                        checked={selectedTeams.includes(team.team_id)}
                        className="bg-slate-800 border-slate-600 data-[state=checked]:bg-blue-500"
                      />
                    </div>
                    <div className="flex items-center gap-4 flex-1">
                      {team.logo_url ? (
                        <img src={team.logo_url} alt={team.name} className="w-16 h-16 rounded-xl object-cover" />
                      ) : (
                        <div className="team-logo w-16 h-16 text-3xl text-blue-400">
                          {team.short_name?.charAt(0) || team.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <h3 className="font-heading font-bold text-white text-xl">{team.name}</h3>
                        <span className="badge-role">{team.short_name}</span>
                        {team.tournament_id && (
                          <p className="text-xs text-blue-400 mt-1">🏆 {getTournamentName(team.tournament_id)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <Coins className="w-4 h-4" />
                        <span className="text-xs uppercase">Budget</span>
                      </div>
                      <p className="font-mono font-bold text-white">{formatPrice(team.budget)}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <Coins className="w-4 h-4 text-green-400" />
                        <span className="text-xs uppercase">Remaining</span>
                      </div>
                      <p className="font-mono font-bold text-green-400">{formatPrice(team.remaining_budget)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Users className="w-4 h-4" />
                      <span className="text-sm">{team.players?.length || 0} Players</span>
                    </div>
                    {team.owner_email && (
                      <span className="text-xs text-slate-500 truncate max-w-[150px]">{team.owner_email}</span>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(team)}
                      className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                    >
                      <Pencil className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingTeam(team);
                        setAssignDialogOpen(true);
                      }}
                      className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                    >
                      <UserPlus className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(team.team_id)}
                      className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {teams.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No teams created yet</p>
            </div>
          )}

          {/* Users Section */}
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="font-heading text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                Registered Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              {users.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Assigned Team</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.user_id}>
                          <td>
                            <div className="flex items-center gap-3">
                              {user.picture ? (
                                <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white text-sm">
                                  {user.name?.charAt(0)}
                                </div>
                              )}
                              <span className="text-white">{user.name}</span>
                            </div>
                          </td>
                          <td className="text-slate-400">{user.email}</td>
                          <td>
                            <Select 
                              value={user.role} 
                              onValueChange={(v) => handleUpdateRole(user.user_id, v)}
                            >
                              <SelectTrigger className="w-[130px] bg-slate-800 border-slate-700 text-white h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-800 border-slate-700">
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="team_owner">Team Owner</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td>
                            {user.team_id ? (
                              <span className="text-blue-400">
                                {teams.find(t => t.team_id === user.team_id)?.name || user.team_id}
                              </span>
                            ) : (
                              <span className="text-slate-500">Not assigned</span>
                            )}
                          </td>
                          <td>
                            {user.role === 'team_owner' && !user.team_id && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-blue-400 hover:text-blue-300"
                                onClick={() => {
                                  setSelectedUser(user.user_id);
                                  setAssignDialogOpen(true);
                                }}
                              >
                                Assign Team
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <p>No users registered yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Assign Team Dialog */}
          <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
            <DialogContent className="bg-slate-900 border-slate-700">
              <DialogHeader>
                <DialogTitle className="font-heading text-white">
                  {editingTeam ? `Assign Owner to ${editingTeam.name}` : 'Assign Team to User'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                {editingTeam ? (
                  <div>
                    <Label className="text-slate-300">Select User</Label>
                    <Select value={selectedUser || ''} onValueChange={setSelectedUser}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue placeholder="Select a user..." />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {teamOwners.map((user) => (
                          <SelectItem key={user.user_id} value={user.user_id}>
                            {user.name} ({user.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div>
                    <Label className="text-slate-300">Select Team</Label>
                    <Select value={editingTeam?.team_id || ''} onValueChange={(v) => setEditingTeam(teams.find(t => t.team_id === v))}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue placeholder="Select a team..." />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {teams.map((team) => (
                          <SelectItem key={team.team_id} value={team.team_id}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <div className="flex justify-end gap-3 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setAssignDialogOpen(false);
                      setSelectedUser(null);
                      setEditingTeam(null);
                    }} 
                    className="border-slate-700 text-slate-300"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleAssignTeam} 
                    disabled={!selectedUser || !editingTeam}
                    className="btn-primary"
                  >
                    Assign
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </Layout>
  );
};

export default TeamManagement;
