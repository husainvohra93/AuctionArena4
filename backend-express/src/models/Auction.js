const mongoose = require('mongoose');

const BidEntrySchema = new mongoose.Schema({
    team_id: String,
    team_name: String,
    team_short_name: String,
    amount: Number,
    timestamp: String
}, { _id: false });

const AuctionSchema = new mongoose.Schema({
    auction_id: { type: String, required: true, unique: true },
    tournament_id: { type: String, required: true },
    name: { type: String, required: true },
    date: { type: String, default: null },
    players_per_team: { type: Number, default: 15 },
    bid_increment_rules: [{
        range_start: Number,
        increment_by: Number
    }],
    pick_mode: { type: String, default: 'manual', enum: ['manual', 'random'] },
    random_pick_delay: { type: Number, default: 5 },
    status: { type: String, default: 'draft', enum: ['draft', 'live', 'paused', 'completed'] },

    current_player_id: { type: String, default: null },
    current_bid: { type: Number, default: 0 },
    current_bidder_id: { type: String, default: null },
    current_bidder_name: { type: String, default: null },
    bid_history: [BidEntrySchema],

    // Last sold info for confetti
    last_sold_player_id: { type: String, default: null },
    last_sold_team_id: { type: String, default: null },
    last_sold_price: { type: Number, default: null },
    last_sold_time: { type: Date, default: null },

    created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Auction', AuctionSchema);
