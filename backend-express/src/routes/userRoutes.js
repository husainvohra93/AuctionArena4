const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Team = require('../models/Team');
const { requireAdmin } = require('../middleware/auth');

// GET /api/admin/users
router.get('/', requireAdmin, async (req, res) => {
    const users = await User.find({}).limit(1000);
    const teams = await Team.find({});
    const teamMap = teams.reduce((acc, t) => {
        acc[t.team_id] = t;
        return acc;
    }, {});

    const enrichedUsers = users.map(u => {
        const uObj = u.toObject();
        if (u.team_id && teamMap[u.team_id]) {
            uObj.team_name = teamMap[u.team_id].name;
            uObj.team_short_name = teamMap[u.team_id].short_name;
        }
        return uObj;
    });

    res.json(enrichedUsers);
});

// POST /api/admin/users (Create User)
router.post('/', requireAdmin, async (req, res) => {
    const { name, email, role, team_id, password } = req.body;

    if (!name || !email) {
        return res.status(400).json({ detail: 'Name and Email are required' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
        return res.status(400).json({ detail: 'User already exists' });
    }

    const userId = `user_${uuidv4().substring(0, 12)}`;
    const defaultPass = "password123";
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password || defaultPass, salt);

    const newUser = new User({
        user_id: userId,
        name,
        email,
        role: role || 'team_owner',
        team_id: team_id || null,
        password: hashedPassword
    });

    await newUser.save();

    if (newUser.team_id) {
        await Team.updateOne(
            { team_id: newUser.team_id },
            { owner_id: newUser.user_id, owner_email: newUser.email }
        );
    }

    res.json(newUser);
});

// PUT /api/admin/users/:userId (Update User generic)
router.put('/:userId', requireAdmin, async (req, res) => {
    const { userId } = req.params;
    const { name, email, role, team_id } = req.body;

    const user = await User.findOne({ user_id: userId });
    if (!user) return res.status(404).json({ detail: 'User not found' });

    if (name) user.name = name;
    if (role) user.role = role;

    const oldTeamId = user.team_id;
    const newTeamId = team_id || null;

    if (oldTeamId !== newTeamId) {
        if (oldTeamId) {
            await Team.updateOne({ team_id: oldTeamId }, { owner_id: null, owner_email: null });
        }
        if (newTeamId) {
            await Team.updateOne({ team_id: newTeamId }, { owner_id: user.user_id, owner_email: user.email });
        }
        user.team_id = newTeamId;
    }

    await user.save();
    res.json({ message: 'User updated', user });
});

// DELETE /api/admin/users/:userId
router.delete('/:userId', requireAdmin, async (req, res) => {
    const { userId } = req.params;
    const user = await User.findOne({ user_id: userId });

    if (!user) return res.status(404).json({ detail: 'User not found' });

    if (user.team_id) {
        await Team.updateOne({ team_id: user.team_id }, { owner_id: null, owner_email: null });
    }

    await User.deleteOne({ user_id: userId });
    res.json({ message: 'User deleted' });
});


// PUT /api/admin/users/:userId/role (Legacy/Specific)
router.put('/:userId/role', requireAdmin, async (req, res) => {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['admin', 'team_owner'].includes(role)) {
        return res.status(400).json({ detail: 'Invalid role' });
    }

    const user = await User.findOneAndUpdate(
        { user_id: userId },
        { role },
        { new: true }
    );

    if (!user) {
        return res.status(404).json({ detail: 'User not found' });
    }

    res.json({ message: 'Role updated' });
});

// PUT /api/admin/users/:userId/team (Specific team assignment)
router.put('/:userId/team', requireAdmin, async (req, res) => {
    const { userId } = req.params;
    const { team_id } = req.body;

    await User.updateOne(
        { user_id: userId },
        { team_id }
    );

    if (team_id) {
        const user = await User.findOne({ user_id: userId });
        await Team.updateOne(
            { team_id },
            { owner_id: userId, owner_email: user.email }
        );
    }

    res.json({ message: 'Team assigned' });
});

module.exports = router;
