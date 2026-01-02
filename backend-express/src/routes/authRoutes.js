const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const Session = require('../models/Session');
const { requireAuth } = require('../middleware/auth');

// Helper to create session and cookie
const createSession = async (user, res) => {
    const sessionToken = `session_${uuidv4().substring(0, 24)}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await Session.create({
        user_id: user.user_id,
        session_token: sessionToken,
        expires_at: expiresAt
    });

    const secureCookie = process.env.SESSION_COOKIE_SECURE === 'true';

    res.cookie('session_token', sessionToken, {
        httpOnly: true,
        secure: secureCookie,
        sameSite: secureCookie ? 'none' : 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000 // ms
    });

    return sessionToken;
};

// POST /api/auth/register
router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ detail: 'Please provide all fields' });
    }

    try {
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ detail: 'User already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const userId = `user_${uuidv4().substring(0, 12)}`;
        user = new User({
            user_id: userId,
            email,
            name,
            password: hashedPassword,
            role: 'team_owner', // Default role
            picture: null
        });

        await user.save();

        // Auto login after register
        const sessionToken = await createSession(user, res);

        res.status(201).json({
            user_id: user.user_id,
            name: user.name,
            email: user.email,
            role: user.role,
            session_token: sessionToken
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ detail: 'Server Error' });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ detail: 'Please provide email and password' });
    }

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ detail: 'Invalid credentials' });
        }

        // If user was created via Google Auth, they might not have a password
        if (!user.password) {
            return res.status(400).json({ detail: 'Please login with Google (or reset password)' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ detail: 'Invalid credentials' });
        }

        const sessionToken = await createSession(user, res);

        res.json({
            user_id: user.user_id,
            name: user.name,
            email: user.email,
            role: user.role,
            session_token: sessionToken
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ detail: 'Server Error' });
    }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
    // Return user without password
    const userObj = req.user.toObject();
    delete userObj.password;
    res.json(userObj);
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
    const sessionToken = req.cookies.session_token;
    if (sessionToken) {
        await Session.deleteOne({ session_token: sessionToken });
    }

    res.clearCookie('session_token', {
        path: '/',
        secure: true, // Should match what was set
        sameSite: 'none'
    });

    res.json({ message: 'Logged out' });
});

module.exports = router;
