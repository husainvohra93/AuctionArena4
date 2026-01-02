const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema({
    user_id: { type: String, required: true },
    session_token: { type: String, required: true, unique: true },
    expires_at: { type: Date, required: true },
    created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Session', SessionSchema, 'user_sessions');
