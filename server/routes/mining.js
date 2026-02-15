const express = require('express');
const auth = require('../middleware/auth');
const Block = require('../models/Block');
const MiningActivity = require('../models/MiningActivity');
const User = require('../models/User');
const SupplyTracker = require('../models/SupplyTracker');
const ReferralCommission = require('../models/ReferralCommission');
const {
    calculateBlockReward,
    getEra,
    getTargetDifficulty,
    verifyMinedHash,
    TOTAL_SUPPLY
} = require('../utils/miningUtils');

const router = express.Router();

// Mining mode configurations
const MINING_MODES = {
    basic: { energyPerTick: 100, multiplier: 1, label: 'Basic' },
    turbo: { energyPerTick: 200, multiplier: 2, label: 'Turbo' },
    super: { energyPerTick: 400, multiplier: 4, label: 'Super' },
    nitro: { energyPerTick: 800, multiplier: 8, label: 'Nitro' }
};

// Stale miner timeout (30 seconds without tick = inactive)
const MINER_TIMEOUT_MS = 30000;

/**
 * Helper: Get or create current active block
 */
async function getOrCreateActiveBlock() {
    let block = await Block.findOne({ status: { $in: ['waiting', 'mining'] } })
        .sort({ blockNumber: -1 });

    if (!block) {
        // Try/catch for E11000 duplicate key error race condition
        try {
            const lastBlock = await Block.findOne().sort({ blockNumber: -1 });
            const nextNumber = lastBlock ? lastBlock.blockNumber + 1 : 1;
            const reward = calculateBlockReward(nextNumber);
            const era = getEra(nextNumber);
            const difficulty = getTargetDifficulty(nextNumber);

            // Check supply cap
            const tracker = await SupplyTracker.getInstance();
            if (!tracker.canMint(reward)) {
                return null; // Supply exhausted
            }

            block = new Block({
                blockNumber: nextNumber,
                targetDifficulty: difficulty,
                reward,
                era,
                status: 'waiting'
            });
            await block.save();
        } catch (err) {
            if (err.code === 11000) {
                // Race condition: block created by another process. Retry.
                return getOrCreateActiveBlock();
            }
            throw err;
        }
    }

    return block;
}

/**
 * Helper: Clean stale miners from a block
 */
function cleanStaleMiners(block) {
    const now = Date.now();
    block.activeMiners = block.activeMiners.filter(
        m => (now - new Date(m.lastTick).getTime()) < MINER_TIMEOUT_MS
    );
}

// GET /api/mining/block - Get current active block
router.get('/block', auth, async (req, res) => {
    try {
        const block = await getOrCreateActiveBlock();

        if (!block) {
            return res.json({
                exhausted: true,
                message: 'All XNH tokens have been mined!',
                totalSupply: TOTAL_SUPPLY
            });
        }

        cleanStaleMiners(block);

        res.json({
            blockNumber: block.blockNumber,
            targetDifficulty: block.targetDifficulty,
            reward: block.reward,
            era: block.era,
            status: block.status,
            onlineMiners: block.activeMiners.length,
            totalShares: block.totalShares,
            totalHashes: block.totalHashes
        });
    } catch (error) {
        console.error('Get block error:', error);
        res.status(500).json({ error: 'Failed to get block info' });
    }
});

// POST /api/mining/join - Join the current block's mining pool
router.post('/join', auth, async (req, res) => {
    try {
        const { mode } = req.body;

        if (!mode || !MINING_MODES[mode]) {
            return res.status(400).json({ error: 'Invalid mining mode' });
        }

        const user = req.user;

        // Check if mode is unlocked
        if (!user.unlockedModes.includes(mode)) {
            return res.status(403).json({ error: `${mode} mode is locked. Purchase it from the shop.` });
        }

        const config = MINING_MODES[mode];

        // Need at least enough energy for 1 tick
        if (user.energy < config.energyPerTick) {
            return res.status(400).json({
                error: 'Not enough energy',
                required: config.energyPerTick,
                current: user.energy
            });
        }

        const block = await getOrCreateActiveBlock();
        if (!block) {
            return res.status(400).json({ error: 'All tokens have been mined!' });
        }

        // Remove user from pool if already there (rejoin)
        block.activeMiners = block.activeMiners.filter(
            m => m.userId.toString() !== user._id.toString()
        );

        // Add user to active miners
        block.activeMiners.push({
            userId: user._id,
            telegramId: user.telegramId,
            joinedAt: new Date(),
            lastTick: new Date(),
            mode
        });

        block.status = 'mining';
        await block.save();

        res.json({
            success: true,
            block: {
                blockNumber: block.blockNumber,
                targetDifficulty: block.targetDifficulty,
                reward: block.reward,
                era: block.era,
                onlineMiners: block.activeMiners.length
            },
            mode: config.label,
            energyPerTick: config.energyPerTick,
            multiplier: config.multiplier
        });
    } catch (error) {
        console.error('Join mining error:', error);
        res.status(500).json({ error: 'Failed to join mining' });
    }
});

// POST /api/mining/tick - Heartbeat: drains energy, keeps miner alive
router.post('/tick', auth, async (req, res) => {
    try {
        const user = req.user;
        const block = await Block.findOne({ status: { $in: ['mining', 'waiting'] } }).sort({ blockNumber: -1 });

        if (!block) {
            return res.json({ continue: true, reason: 'Between blocks', energy: user.energy, maxEnergy: user.maxEnergy });
        }

        // Find this user in active miners
        const minerIdx = block.activeMiners.findIndex(
            m => m.userId.toString() === user._id.toString()
        );

        if (minerIdx === -1) {
            // Miner might be between blocks (just submitted, about to rejoin)
            return res.json({ continue: true, reason: 'Rejoining pool', energy: user.energy, maxEnergy: user.maxEnergy });
        }

        const miner = block.activeMiners[minerIdx];
        const config = MINING_MODES[miner.mode];

        // Check energy
        if (user.energy < config.energyPerTick) {
            // Remove from pool
            block.activeMiners.splice(minerIdx, 1);
            await block.save();
            return res.json({
                continue: false,
                reason: 'Out of energy',
                energy: user.energy
            });
        }

        // Drain energy
        user.energy -= config.energyPerTick;
        await user.save();

        // Update tick timestamp and hashcount using atomic update to avoid VersionError
        // We do this instead of block.save()
        await Block.updateOne(
            { _id: block._id, "activeMiners.userId": user._id },
            {
                $set: { "activeMiners.$.lastTick": new Date() },
                $inc: { totalHashes: (Math.floor(Math.random() * 500) + 100) * config.multiplier, totalShares: 1 }
            }
        );

        res.json({
            continue: true,
            energy: user.energy,
            maxEnergy: user.maxEnergy,
            tokens: user.tokens,
            onlineMiners: block.activeMiners.length,
            totalHashes: block.totalHashes
        });
    } catch (error) {
        console.error('Tick error:', error);
        res.status(500).json({ error: 'Tick failed' });
    }
});

// POST /api/mining/submit - Submit a found hash
router.post('/submit', auth, async (req, res) => {
    try {
        const { hash, nonce } = req.body;
        const user = req.user;

        if (!hash || nonce === undefined) {
            return res.status(400).json({ error: 'Hash and nonce are required' });
        }

        let block = await Block.findOne({ status: 'mining' }).sort({ blockNumber: -1 });
        if (!block) {
            return res.status(400).json({ error: 'No active block to submit to' });
        }

        // Verify the hash server-side
        const currentBlockNumber = block.blockNumber;
        const { valid, hash: computedHash } = verifyMinedHash(
            currentBlockNumber, nonce, user.telegramId, block.targetDifficulty
        );

        if (!valid) {
            return res.status(400).json({
                error: 'Invalid hash — does not meet difficulty',
                submitted: hash,
                computed: computedHash,
                required: '0'.repeat(block.targetDifficulty) + '...'
            });
        }

        // ---- Block found! Atomically lock it ----
        // 1. Attempt to set status to 'processing_rewards'
        // This ensures only one request succeeds in claiming the block
        block = await Block.findOneAndUpdate(
            { _id: block._id, status: 'mining' },
            {
                status: 'processing_rewards',
                minedBy: user._id,
                winningHash: computedHash
            },
            { new: true }
        );

        if (!block) {
            // Check if it was already mined
            const completedBlock = await Block.findOne({ blockNumber: currentBlockNumber, status: 'completed' });
            if (completedBlock) {
                return res.status(400).json({ error: 'Block already mined by someone else' });
            }
            return res.status(400).json({ error: 'Block execution race failed found/processing' });
        }

        // ---- Distribute rewards ----
        const tracker = await SupplyTracker.getInstance();
        let blockReward = block.reward;

        // Cap reward to remaining supply
        if (!tracker.canMint(blockReward)) {
            blockReward = Math.max(0, tracker.maxSupply - tracker.totalMinted);
        }

        if (blockReward <= 0) {
            return res.status(400).json({ error: 'Supply exhausted. No more tokens to mine.' });
        }

        // Clean stale miners
        cleanStaleMiners(block);

        // 50% to finder, 50% to pool
        const finderReward = Math.round(blockReward * 0.5 * 100) / 100;
        const poolTotal = blockReward - finderReward;

        // Pool miners = everyone except the finder who was active
        const poolMiners = block.activeMiners.filter(
            m => m.userId.toString() !== user._id.toString()
        );
        const poolShareEach = poolMiners.length > 0
            ? Math.round((poolTotal / poolMiners.length) * 100) / 100
            : 0;

        // If no pool miners, finder gets full reward
        const actualFinderReward = poolMiners.length > 0 ? finderReward : blockReward;

        // Award finder
        user.tokens += actualFinderReward;
        user.totalMined += actualFinderReward;
        user.miningSessionsCount += 1;
        await user.save();

        // Create finder activity
        const finderActivity = new MiningActivity({
            userId: user._id,
            blockId: block._id,
            mode: block.activeMiners.find(m => m.userId.toString() === user._id.toString())?.mode || 'basic',
            energyConsumed: 0,
            tokensEarned: actualFinderReward,
            hashSubmitted: computedHash,
            nonceUsed: nonce,
            isBlockFinder: true,
            shareReward: 0
        });
        await finderActivity.save();

        // Award pool miners
        const poolRewards = [];
        for (const miner of poolMiners) {
            const poolUser = await User.findById(miner.userId);
            if (poolUser) {
                poolUser.tokens += poolShareEach;
                poolUser.totalMined += poolShareEach;
                poolUser.miningSessionsCount += 1;
                await poolUser.save();

                const activity = new MiningActivity({
                    userId: poolUser._id,
                    blockId: block._id,
                    mode: miner.mode,
                    energyConsumed: 0,
                    tokensEarned: poolShareEach,
                    isBlockFinder: false,
                    shareReward: poolShareEach
                });
                await activity.save();

                poolRewards.push({
                    userId: poolUser._id,
                    username: poolUser.username || poolUser.firstName,
                    reward: poolShareEach
                });
            }
        }

        // Handle referral commission (10% of finder's reward)
        if (user.referredBy) {
            const referrer = await User.findOne({ referralCode: user.referredBy });
            if (referrer) {
                const commission = Math.round(actualFinderReward * 0.10 * 100) / 100;
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

        // Update supply tracker
        const totalRewarded = actualFinderReward + (poolShareEach * poolMiners.length);
        tracker.recordMint(totalRewarded, block.blockNumber);
        await tracker.save();

        // Mark block as completed
        block.status = 'completed';
        block.completedAt = new Date();
        block.minedBy = user._id;
        block.winningHash = computedHash;
        block.winningNonce = nonce;
        await block.save();

        // Create next block
        await getOrCreateActiveBlock();

        res.json({
            success: true,
            blockNumber: block.blockNumber,
            hash: computedHash,
            nonce,
            finderReward: actualFinderReward,
            poolMinersCount: poolMiners.length,
            poolShareEach,
            totalBlockReward: blockReward,
            newBalance: {
                tokens: user.tokens,
                totalMined: user.totalMined,
                energy: user.energy,
                maxEnergy: user.maxEnergy
            },
            poolRewards
        });
    } catch (error) {
        console.error('Submit hash error:', error);
        res.status(500).json({ error: 'Failed to submit hash' });
    }
});

// POST /api/mining/leave - Leave the mining pool
router.post('/leave', auth, async (req, res) => {
    try {
        const block = await Block.findOne({ status: 'mining' }).sort({ blockNumber: -1 });
        if (!block) {
            return res.json({ success: true });
        }

        block.activeMiners = block.activeMiners.filter(
            m => m.userId.toString() !== req.user._id.toString()
        );
        await block.save();

        res.json({ success: true, onlineMiners: block.activeMiners.length });
    } catch (error) {
        console.error('Leave error:', error);
        res.status(500).json({ error: 'Failed to leave pool' });
    }
});

// GET /api/mining/status - Get user's current mining status
router.get('/status', auth, async (req, res) => {
    try {
        const block = await Block.findOne({ status: { $in: ['waiting', 'mining'] } })
            .sort({ blockNumber: -1 });

        if (!block) {
            return res.json({ mining: false });
        }

        const miner = block.activeMiners.find(
            m => m.userId.toString() === req.user._id.toString()
        );

        res.json({
            mining: !!miner,
            mode: miner?.mode || null,
            joinedAt: miner?.joinedAt || null,
            block: {
                blockNumber: block.blockNumber,
                targetDifficulty: block.targetDifficulty,
                reward: block.reward,
                onlineMiners: block.activeMiners.length
            }
        });
    } catch (error) {
        console.error('Status error:', error);
        res.status(500).json({ error: 'Failed to get status' });
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
            .populate('blockId', 'blockNumber targetDifficulty');

        const total = await MiningActivity.countDocuments({ userId: req.user._id });

        res.json({
            activities: activities.map(a => ({
                id: a._id,
                blockNumber: a.blockId?.blockNumber,
                mode: a.mode,
                energyConsumed: a.energyConsumed,
                tokensEarned: a.tokensEarned,
                isBlockFinder: a.isBlockFinder,
                hashSubmitted: a.hashSubmitted,
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

        // Build previous hash map
        const prevHashMap = {};
        try {
            const blockNumbers = blocks.map(b => b.blockNumber);
            if (blockNumbers.length > 0) {
                const prevBlocks = await Block.find({
                    blockNumber: { $in: blockNumbers.map(n => n - 1) },
                    status: 'completed'
                }).select('blockNumber winningHash');
                prevBlocks.forEach(pb => { prevHashMap[pb.blockNumber + 1] = pb.winningHash; });
            }
        } catch (err) {
            console.error('Prev hash lookup error (non-fatal):', err);
        }

        res.json({
            blocks: blocks.map(b => ({
                blockNumber: b.blockNumber,
                targetDifficulty: b.targetDifficulty,
                reward: b.reward,
                era: b.era,
                minedBy: b.minedBy?.username || b.minedBy?.firstName || 'Anonymous',
                winningHash: b.winningHash || null,
                previousHash: prevHashMap[b.blockNumber] || '0000000000000000',
                winningNonce: b.winningNonce,
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
    const user = req.user;
    res.json({
        modes: Object.entries(MINING_MODES).map(([key, config]) => ({
            id: key,
            label: config.label,
            energyPerTick: config.energyPerTick,
            multiplier: config.multiplier,
            unlocked: user.unlockedModes.includes(key),
            available: user.unlockedModes.includes(key) && user.energy >= config.energyPerTick
        }))
    });
});

module.exports = router;
