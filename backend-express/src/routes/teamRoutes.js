const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Team = require('../models/Team');
const Player = require('../models/Player');
const { requireAdmin } = require('../middleware/auth');

// POST /api/teams
router.post('/', requireAdmin, async (req, res) => {
    const { name, short_name, logo_url, budget, owner_email, tournament_id } = req.body;

    const teamId = `team_${uuidv4().substring(0, 8)}`;
    const team = new Team({
        team_id: teamId,
        name,
        short_name,
        logo_url,
        budget: budget || 10000000,
        remaining_budget: budget || 10000000,
        owner_email,
        tournament_id,
        players: []
    });

    await team.save();
    res.json(team);
});

// GET /api/teams
router.get('/', async (req, res) => {
    const { tournament_id } = req.query;
    const query = {};
    if (tournament_id) query.tournament_id = tournament_id;

    const teams = await Team.find(query).limit(100);
    res.json(teams);
});

// GET /api/teams/:id
router.get('/:id', async (req, res) => {
    const team = await Team.findOne({ team_id: req.params.id });
    if (!team) return res.status(404).json({ detail: 'Team not found' });
    res.json(team);
});

// PUT /api/teams/:id
router.put('/:id', requireAdmin, async (req, res) => {
    const { name, short_name, logo_url, budget, owner_email, tournament_id } = req.body;

    const team = await Team.findOneAndUpdate(
        { team_id: req.params.id },
        { name, short_name, logo_url, budget, owner_email, tournament_id },
        { new: true }
    );

    if (!team) return res.status(404).json({ detail: 'Team not found' });
    res.json(team);
});

// DELETE /api/teams/:id
router.delete('/:id', requireAdmin, async (req, res) => {
    const result = await Team.deleteOne({ team_id: req.params.id });
    if (result.deletedCount === 0) return res.status(404).json({ detail: 'Team not found' });

    // Reset players sold to this team?? Python didn't seem to do it in single delete, but bulk delete did.
    // Wait, bulk-delete did: "Also reset any players assigned to these teams"
    // I should probably do it here too for consistency, but sticking to Python behavior for now unless logic dictates otherwise.
    // Python single delete: just delete_one.
    res.json({ message: 'Team deleted' });
});

// POST /api/teams/bulk-delete
router.post('/bulk-delete', requireAdmin, async (req, res) => {
    const { ids } = req.body;
    if (!ids || !ids.length) return res.status(400).json({ detail: 'No team IDs provided' });

    await Player.updateMany(
        { sold_to: { $in: ids } },
        { sold_to: null, sold_price: null, status: 'unsold' }
    );

    const result = await Team.deleteMany({ team_id: { $in: ids } });
    res.json({ message: `Deleted ${result.deletedCount} teams`, deleted_count: result.deletedCount });
});

// GET /api/teams/:id/squad
router.get('/:id/squad', async (req, res) => {
    const team = await Team.findOne({ team_id: req.params.id });
    if (!team) return res.status(404).json({ detail: 'Team not found' });

    const players = await Player.find({ sold_to: req.params.id });
    res.json({ team, players });
});

module.exports = router;
