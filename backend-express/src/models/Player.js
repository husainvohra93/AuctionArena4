const mongoose = require('mongoose');

const PlayerSchema = new mongoose.Schema({
    player_id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    role: { type: String, required: true },
    base_price: { type: Number, required: true },
    current_price: { type: Number, default: 0 },
    image_url: { type: String, default: null },
    age: { type: Number, default: null },
    batting_style: { type: String, default: null },
    bowling_style: { type: String, default: null },
    matches: { type: Number, default: 0 },
    runs: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    status: { type: String, default: 'unsold', enum: ['unsold', 'sold', 'in_auction', 'passed'] },
    sold_to: { type: String, default: null }, // team_id
    sold_price: { type: Number, default: null },
    tournament_id: { type: String, default: null },
    auction_id: { type: String, default: null },
    was_unsold: { type: Boolean, default: false }, // For re-auction pool
    created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Player', PlayerSchema);
