const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema({
    team_id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    short_name: { type: String, required: true },
    logo_url: { type: String, default: null },
    budget: { type: Number, required: true },
    remaining_budget: { type: Number, required: true },
    owner_id: { type: String, default: null },
    owner_email: { type: String, default: null },
    players: [{ type: String }], // Array of player_ids
    tournament_id: { type: String, default: null },
    created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Team', TeamSchema);
