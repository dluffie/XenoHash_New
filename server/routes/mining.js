const express = require('express');
const auth = require('../middleware/auth');
const Block = require('../models/Block');
const MiningActivity = require('../models/MiningActivity');
const User = require('../models/User');
const ReferralCommission = require('../models/ReferralCommission');

const router = express.Router();

// Mining mode configurations
const MINING_MODES = {
    basic: { energyCost: 100, multiplier: 1, label: 'Basic' },
    turbo: { energyCost: 200, multiplier: 2, label: 'Turbo' },
    super: { energyCost: 400, multiplier: 4, label: 'Super' },
    nitro: { energyCost: 800, multiplier: 8, label: 'Nitro' }
};

// Base reward range
const BASE_MIN_REWARD = 50;
const BASE_MAX_REWARD = 200;
const BIG_WIN_CHANCE = 0.10; // 10% chance
const BIG_WIN_MULTIPLIER = 5;

// Generate a random reward based on mode
function calculateReward(mode) {
    const config = MINING_MODES[mode];
    let reward = Math.random() * (BASE_MAX_REWARD - BASE_MIN_REWARD) + BASE_MIN_REWARD;

    // 10% chance of big win
    if (Math.random() < BIG_WIN_CHANCE) {
        reward *= BIG_WIN_MULTIPLIER;
    }

    reward *= config.multiplier;
    return Math.round(reward * 100) / 100; // Round to 2 decimals
}

// GET /api/mining/block - Get current active block
router.get('/block', auth, async (req, res) => {
    try {
        let block = await Block.findOne({ status: { $in: ['waiting', 'mining'] } })
            .sort({ blockNumber: -1 });

        if (!block) {
            // Create a new block
            const lastBlock = await Block.findOne().sort({ blockNumber: -1 });
            const nextNumber = lastBlock ? lastBlock.blockNumber + 1 : 1;

            block = new Block({
                blockNumber: nextNumber,
                difficulty: 84500 + Math.floor(Math.random() * 10000),
                reward: 800 + Math.floor(Math.random() * 600),
                status: 'waiting',
                onlineMiners: Math.floor(Math.random() * 200) + 50
            });
            await block.save();
        }

        res.json({
            blockNumber: block.blockNumber,
            difficulty: block.difficulty,
            reward: block.reward,
            status: block.status,
            onlineMiners: block.onlineMiners,
            totalShares: block.totalShares,
            totalHashes: block.totalHashes
        });
    } catch (error) {
        console.error('Get block error:', error);
        res.status(500).json({ error: 'Failed to get block info' });
    }
});

// POST /api/mining/start - Start mining session
router.post('/start', auth, async (req, res) => {
    try {
        const { mode } = req.body;

        if (!mode || !MINING_MODES[mode]) {
            return res.status(400).json({ error: 'Invalid mining mode. Use: basic, turbo, super, nitro' });
        }

        const config = MINING_MODES[mode];
        const user = req.user;

        // Check energy
        if (user.energy < config.energyCost) {
            return res.status(400).json({
                error: 'Not enough energy',
                required: config.energyCost,
                current: user.energy
            });
        }

        // Get or create current block
        let block = await Block.findOne({ status: { $in: ['waiting', 'mining'] } })
            .sort({ blockNumber: -1 });

        if (!block) {
            const lastBlock = await Block.findOne().sort({ blockNumber: -1 });
            const nextNumber = lastBlock ? lastBlock.blockNumber + 1 : 1;

            block = new Block({
                blockNumber: nextNumber,
                difficulty: 84500 + Math.floor(Math.random() * 10000),
                reward: 800 + Math.floor(Math.random() * 600),
                status: 'mining',
                onlineMiners: Math.floor(Math.random() * 200) + 50
            });
            await block.save();
        }

        // Update block status
        block.status = 'mining';
        block.totalShares += 1;
        block.totalHashes += Math.floor(Math.random() * 1000) + 100;
        block.onlineMiners = Math.max(block.onlineMiners, Math.floor(Math.random() * 50) + 50);

        // Calculate reward
        const tokensEarned = calculateReward(mode);

        // Deduct energy and add tokens
        user.energy -= config.energyCost;
        user.tokens += tokensEarned;
        user.totalMined += tokensEarned;
        user.miningSessionsCount += 1;

        // Create mining activity record
        const activity = new MiningActivity({
            userId: user._id,
            blockId: block._id,
            mode,
            energyConsumed: config.energyCost,
            tokensEarned
        });

        // Handle referral commission (10% to referrer)
        if (user.referredBy) {
            const referrer = await User.findOne({ referralCode: user.referredBy });
            if (referrer) {
                const commission = Math.round(tokensEarned * 0.10 * 100) / 100;
                referrer.tokens += commission;
                referrer.referralEarnings += commission;
                await referrer.save();

                await new ReferralCommission({
                    referrerId: referrer._id,
                    referredUserId: user._id,
                    commission,
                    source: 'mining'
                }).save();
            }
        }

        // Check if block should complete (after enough shares)
        if (block.totalShares >= 50 + Math.floor(Math.random() * 50)) {
            block.status = 'completed';
            block.completedAt = new Date();
            block.minedBy = user._id;
        }

        await Promise.all([user.save(), block.save(), activity.save()]);

        res.json({
            success: true,
            mode: config.label,
            energyConsumed: config.energyCost,
            tokensEarned,
            newBalance: {
                energy: user.energy,
                maxEnergy: user.maxEnergy,
                tokens: user.tokens,
                totalMined: user.totalMined
            },
            block: {
                blockNumber: block.blockNumber,
                status: block.status,
                totalShares: block.totalShares,
                totalHashes: block.totalHashes
            }
        });
    } catch (error) {
        console.error('Mining error:', error);
        res.status(500).json({ error: 'Mining failed' });
    }
});

// GET /api/mining/history - User's mining history
router.get('/history', auth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const activities = await MiningActivity.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('blockId', 'blockNumber difficulty');

        const total = await MiningActivity.countDocuments({ userId: req.user._id });

        res.json({
            activities: activities.map(a => ({
                id: a._id,
                blockNumber: a.blockId?.blockNumber,
                mode: a.mode,
                energyConsumed: a.energyConsumed,
                tokensEarned: a.tokensEarned,
                createdAt: a.createdAt
            })),
            pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        });
    } catch (error) {
        console.error('History error:', error);
        res.status(500).json({ error: 'Failed to get mining history' });
    }
});

// GET /api/mining/last-blocks - Last completed blocks
router.get('/last-blocks', auth, async (req, res) => {
    try {
        const blocks = await Block.find({ status: 'completed' })
            .sort({ completedAt: -1 })
            .limit(10)
            .populate('minedBy', 'username firstName');

        res.json({
            blocks: blocks.map(b => ({
                blockNumber: b.blockNumber,
                difficulty: b.difficulty,
                reward: b.reward,
                minedBy: b.minedBy?.username || b.minedBy?.firstName || 'Anonymous',
                totalShares: b.totalShares,
                totalHashes: b.totalHashes,
                completedAt: b.completedAt
            }))
        });
    } catch (error) {
        console.error('Last blocks error:', error);
        res.status(500).json({ error: 'Failed to get blocks' });
    }
});

// GET /api/mining/modes - Get available mining modes
router.get('/modes', auth, async (req, res) => {
    res.json({
        modes: Object.entries(MINING_MODES).map(([key, config]) => ({
            id: key,
            label: config.label,
            energyCost: config.energyCost,
            multiplier: config.multiplier,
            available: req.user.energy >= config.energyCost
        }))
    });
});

module.exports = router;
