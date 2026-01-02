const express = require('express');
const router = express.Router();
const Player = require('../models/Player');
const Team = require('../models/Team');
const Tournament = require('../models/Tournament');
const Auction = require('../models/Auction');

// GET /api/stats/dashboard
router.get('/dashboard', async (req, res) => {
    const { tournament_id } = req.query;
    const query = {};
    if (tournament_id) {
        query.tournament_id = tournament_id;
    }

    const totalPlayers = await Player.countDocuments(query);
    const soldPlayers = await Player.countDocuments({ ...query, status: 'sold' });
    const unsoldPlayers = await Player.countDocuments({ ...query, status: 'unsold' });
    const inAuction = await Player.countDocuments({ ...query, status: 'in_auction' });

    const teamQuery = tournament_id ? { tournament_id } : {};
    const totalTeams = await Team.countDocuments(teamQuery);

    // Tournaments is global usually, or filterable? Python: `total_tournaments = await db.tournaments.count_documents({})`
    const totalTournaments = await Tournament.countDocuments({});

    const auctionQuery = tournament_id ? { tournament_id } : {};
    const totalAuctions = await Auction.countDocuments(auctionQuery);

    const soldPlayersList = await Player.find({ ...query, status: 'sold' }).select('sold_price');
    const totalSpent = soldPlayersList.reduce((sum, p) => sum + (p.sold_price || 0), 0);

    res.json({
        total_players: totalPlayers,
        sold_players: soldPlayers,
        unsold_players: unsoldPlayers,
        in_auction: inAuction,
        total_teams: totalTeams,
        total_tournaments: totalTournaments,
        total_auctions: totalAuctions,
        total_spent: totalSpent
    });
});

module.exports = router;
