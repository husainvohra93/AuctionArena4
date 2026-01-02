const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Player = require('../models/Player');
const Team = require('../models/Team');
const { requireAdmin } = require('../middleware/auth');

// POST /api/players
router.post('/', requireAdmin, async (req, res) => {
    const { name, role, base_price, image_url, age, batting_style, bowling_style, matches, runs, wickets, tournament_id } = req.body;

    const playerId = `player_${uuidv4().substring(0, 8)}`;
    const player = new Player({
        player_id: playerId,
        name,
        role,
        base_price,
        current_price: 0,
        image_url,
        age,
        batting_style,
        bowling_style,
        matches,
        runs,
        wickets,
        status: 'unsold',
        tournament_id,
        created_at: new Date()
    });

    await player.save();
    res.json(player);
});

// GET /api/players
router.get('/', async (req, res) => {
    const { status, tournament_id } = req.query;
    const query = {};
    if (status) query.status = status;
    if (tournament_id) query.tournament_id = tournament_id;

    const players = await Player.find(query).limit(1000);
    res.json(players);
});

// GET /api/players/:id
router.get('/:id', async (req, res) => {
    const player = await Player.findOne({ player_id: req.params.id });
    if (!player) return res.status(404).json({ detail: 'Player not found' });
    res.json(player);
});

// PUT /api/players/:id
router.put('/:id', requireAdmin, async (req, res) => {
    const player = await Player.findOneAndUpdate(
        { player_id: req.params.id },
        { ...req.body },
        { new: true }
    );
    if (!player) return res.status(404).json({ detail: 'Player not found' });
    res.json(player);
});

// DELETE /api/players/:id
router.delete('/:id', requireAdmin, async (req, res) => {
    const result = await Player.deleteOne({ player_id: req.params.id });
    if (result.deletedCount === 0) return res.status(404).json({ detail: 'Player not found' });
    res.json({ message: 'Player deleted' });
});

// POST /api/players/bulk-delete
router.post('/bulk-delete', requireAdmin, async (req, res) => {
    const { ids } = req.body;
    if (!ids || !ids.length) return res.status(400).json({ detail: 'No player IDs provided' });

    const result = await Player.deleteMany({ player_id: { $in: ids } });
    res.json({ message: `Deleted ${result.deletedCount} players`, deleted_count: result.deletedCount });
});

// POST /api/players/:id/reset
router.post('/:id/reset', requireAdmin, async (req, res) => {
    const player = await Player.findOne({ player_id: req.params.id });
    if (!player) return res.status(404).json({ detail: 'Player not found' });

    if (player.sold_to && player.sold_price) {
        await Team.updateOne(
            { team_id: player.sold_to },
            {
                $inc: { remaining_budget: player.sold_price },
                $pull: { players: req.params.id }
            }
        );
    }

    player.status = 'unsold';
    player.sold_to = null;
    player.sold_price = null;
    player.current_price = 0;
    player.auction_id = null;
    await player.save();

    res.json(player);
});

module.exports = router;
