const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// GET /api/leaderboard - Top 100 users by tokens
router.get('/', auth, async (req, res) => {
    try {
        const topUsers = await User.find()
            .select('username firstName lastName tokens totalMined energy maxEnergy photoUrl')
            .sort({ tokens: -1 })
            .limit(100);

        // Find current user's rank
        const userRank = await User.countDocuments({ tokens: { $gt: req.user.tokens } }) + 1;

        res.json({
            leaderboard: topUsers.map((u, index) => ({
                rank: index + 1,
                username: u.username || u.firstName || 'Anonymous',
                tokens: u.tokens,
                totalMined: u.totalMined,
                photoUrl: u.photoUrl || ''
            })),
            myRank: userRank,
            myTokens: req.user.tokens
        });
    } catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).json({ error: 'Failed to get leaderboard' });
    }
});

module.exports = router;
