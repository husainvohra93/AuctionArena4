const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');

// Load env vars
dotenv.config();

// Connect DB
connectDB();

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : 'http://localhost:3000',
    credentials: true
}));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/admin/users', require('./routes/userRoutes'));
app.use('/api/teams', require('./routes/teamRoutes'));
app.use('/api/players', require('./routes/playerRoutes'));
app.use('/api/tournaments', require('./routes/tournamentRoutes'));
app.use('/api/auctions', require('./routes/auctionRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));
// Combined export and import logic in dataRoutes, plus stats
app.use('/api', require('./routes/dataRoutes')); // Mounts to /api because dataRoutes handles /import and /export paths specifically
app.use('/api/stats', require('./routes/statsRoutes'));

// Static uploads
app.use('/api/uploads', express.static(path.join(__dirname, '../uploads')));

// Legacy support: /api/auction/state -> map to legacy logic or simplified
// Python had `api_router` prefix `/api`.
// app.get('/api/auction/state') ... I implemented logic in `auctionRoutes.js` but routed it differently? 
// No, I missed `/api/auction/state`. I should add it to `auctionRoutes` or main server.
// The AuctionArena implementation might expect `/api/auction/state` specifically.
// I'll add a simple redirect or handler here.

const Auction = require('./models/Auction');
const Player = require('./models/Player');
const Team = require('./models/Team');

app.get('/api/auction/state', async (req, res) => {
    // Find live auction
    const auction = await Auction.findOne({ status: 'live' });
    if (!auction) {
        return res.json({
            auction_id: null,
            is_active: false,
            current_player_id: null,
            current_bid: 0,
            current_bidder_id: null,
            current_bidder_name: null,
            bid_history: [],
            current_player: null,
            current_bidder_team: null
        });
    }
    // Redirect to get detail of this auction
    res.redirect(`/api/auctions/${auction.auction_id}`);
});

app.get('/api', (req, res) => {
    res.json({ message: 'Cricket Auction API v2 (Node.js)' });
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
