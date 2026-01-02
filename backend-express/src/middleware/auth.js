const Session = require('../models/Session');
const User = require('../models/User');

const getCurrentUser = async (req) => {
    let sessionToken = req.cookies.session_token;

    if (!sessionToken && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        sessionToken = req.headers.authorization.split(' ')[1];
    }

    if (!sessionToken) return null;

    const session = await Session.findOne({ session_token: sessionToken });
    if (!session) return null;

    if (new Date(session.expires_at) < new Date()) {
        return null; // Expired
    }

    const user = await User.findOne({ user_id: session.user_id });
    return user;
};

const requireAuth = async (req, res, next) => {
    try {
        const user = await getCurrentUser(req);
        if (!user) {
            return res.status(401).json({ detail: 'Not authenticated' });
        }
        req.user = user;
        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({ detail: 'Server Error' });
    }
};

const requireAdmin = async (req, res, next) => {
    try {
        const user = await getCurrentUser(req);
        if (!user) {
            return res.status(401).json({ detail: 'Not authenticated' });
        }
        if (user.role !== 'admin') {
            return res.status(403).json({ detail: 'Admin access required' });
        }
        req.user = user;
        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({ detail: 'Server Error' });
    }
};

module.exports = { requireAuth, requireAdmin };
