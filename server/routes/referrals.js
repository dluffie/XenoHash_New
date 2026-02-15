const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const ReferralCommission = require('../models/ReferralCommission');

const router = express.Router();

// GET /api/referrals - Get referral info and stats
router.get('/', auth, async (req, res) => {
    try {
        const user = req.user;

        res.json({
            referralCode: user.referralCode,
            referralCount: user.referralCount,
            referralEarnings: user.referralEarnings,
            referralLink: `https://t.me/YourBotUsername?start=${user.referralCode}`
        });
    } catch (error) {
        console.error('Referrals error:', error);
        res.status(500).json({ error: 'Failed to get referral info' });
    }
});

// GET /api/referrals/list - List invited friends
router.get('/list', auth, async (req, res) => {
    try {
        const referredUsers = await User.find({ referredBy: req.user.referralCode })
            .select('username firstName lastName tokens totalMined createdAt')
            .sort({ createdAt: -1 })
            .limit(50);

        const commissions = await ReferralCommission.find({ referrerId: req.user._id })
            .sort({ createdAt: -1 })
            .limit(100);

        res.json({
            friends: referredUsers.map(u => ({
                username: u.username || u.firstName || 'Anonymous',
                tokens: u.tokens,
                totalMined: u.totalMined,
                joinedAt: u.createdAt
            })),
            recentCommissions: commissions.map(c => ({
                commission: c.commission,
                source: c.source,
                date: c.createdAt
            }))
        });
    } catch (error) {
        console.error('Referral list error:', error);
        res.status(500).json({ error: 'Failed to get referral list' });
    }
});

module.exports = router;
