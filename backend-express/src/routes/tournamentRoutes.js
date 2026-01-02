const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Tournament = require('../models/Tournament');
const Auction = require('../models/Auction');
const { requireAdmin } = require('../middleware/auth');

// POST /api/tournaments
router.post('/', requireAdmin, async (req, res) => {
    const { name, description, start_date, end_date } = req.body;

    const tournamentId = `tournament_${uuidv4().substring(0, 8)}`;
    const tournament = new Tournament({
        tournament_id: tournamentId,
        name,
        description,
        start_date,
        end_date,
        status: 'draft'
    });

    await tournament.save();
    res.json(tournament);
});

// GET /api/tournaments
router.get('/', async (req, res) => {
    const tournaments = await Tournament.find({}).limit(100);
    res.json(tournaments);
});

// GET /api/tournaments/:id
router.get('/:id', async (req, res) => {
    const tournament = await Tournament.findOne({ tournament_id: req.params.id });
    if (!tournament) return res.status(404).json({ detail: 'Tournament not found' });
    res.json(tournament);
});

// PUT /api/tournaments/:id
router.put('/:id', requireAdmin, async (req, res) => {
    const { name, description, start_date, end_date } = req.body;

    const tournament = await Tournament.findOneAndUpdate(
        { tournament_id: req.params.id },
        { name, description, start_date, end_date },
        { new: true }
    );

    if (!tournament) return res.status(404).json({ detail: 'Tournament not found' });
    res.json(tournament);
});

// DELETE /api/tournaments/:id
router.delete('/:id', requireAdmin, async (req, res) => {
    const result = await Tournament.deleteOne({ tournament_id: req.params.id });
    if (result.deletedCount === 0) return res.status(404).json({ detail: 'Tournament not found' });

    await Auction.deleteMany({ tournament_id: req.params.id });
    res.json({ message: 'Tournament deleted' });
});

module.exports = router;
