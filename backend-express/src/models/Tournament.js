const mongoose = require('mongoose');

const TournamentSchema = new mongoose.Schema({
    tournament_id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: null },
    start_date: { type: String, default: null },
    end_date: { type: String, default: null },
    status: { type: String, default: 'draft', enum: ['draft', 'active', 'completed'] },
    created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Tournament', TournamentSchema);
