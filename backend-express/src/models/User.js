const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    user_id: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    name: { type: String, required: true },
    picture: { type: String, default: null },
    role: { type: String, enum: ['admin', 'team_owner'], default: 'team_owner' },
    password: { type: String }, // Hashed password
    team_id: { type: String, default: null },
    created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
