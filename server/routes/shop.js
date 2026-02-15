const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Purchase = require('../models/Purchase');

const router = express.Router();

// Shop items configuration
const SHOP_ITEMS = {
    energy_boost: {
        label: 'Energy Boost',
        description: 'Instantly adds +2000 energy and increases max energy',
        tonPrice: 0.5,
        icon: '⚡',
        repeatable: true
    },
    turbo_unlock: {
        label: 'Turbo Mode',
        description: '2x mining multiplier — mine twice as fast',
        tonPrice: 0.5,
        icon: '🚀',
        repeatable: false,
        unlocks: 'turbo'
    },
    super_unlock: {
        label: 'Super Mode',
        description: '4x mining multiplier — serious mining power',
        tonPrice: 0.5,
        icon: '💥',
        repeatable: false,
        unlocks: 'super'
    },
    nitro_unlock: {
        label: 'Nitro Mode',
        description: '8x mining multiplier — maximum power',
        tonPrice: 0.5,
        icon: '🔥',
        repeatable: false,
        unlocks: 'nitro'
    }
};

// GET /api/shop/items - List available shop items
router.get('/items', auth, async (req, res) => {
    try {
        const user = req.user;
        const items = Object.entries(SHOP_ITEMS).map(([id, item]) => ({
            id,
            ...item,
            purchased: !item.repeatable && item.unlocks
                ? user.unlockedModes.includes(item.unlocks)
                : false
        }));

        res.json({ items, walletAddress: process.env.TON_WALLET_ADDRESS || null });
    } catch (error) {
        console.error('Shop items error:', error);
        res.status(500).json({ error: 'Failed to get shop items' });
    }
});

// POST /api/shop/purchase - Record a purchase and apply it
// Client sends the BOC after the TON Connect transaction succeeds
router.post('/purchase', auth, async (req, res) => {
    try {
        const { type, boc } = req.body;
        const user = req.user;

        if (!type || !SHOP_ITEMS[type]) {
            return res.status(400).json({ error: 'Invalid item type' });
        }

        if (!boc) {
            return res.status(400).json({ error: 'Transaction BOC is required' });
        }

        const item = SHOP_ITEMS[type];

        // Check if already purchased (non-repeatable)
        if (!item.repeatable && item.unlocks && user.unlockedModes.includes(item.unlocks)) {
            return res.status(400).json({ error: `${item.label} is already unlocked` });
        }

        // Check if this BOC was already used
        const existingPurchase = await Purchase.findOne({ bocHash: boc, status: 'confirmed' });
        if (existingPurchase) {
            return res.status(400).json({ error: 'This transaction has already been used' });
        }

        // Create purchase record
        const purchase = new Purchase({
            userId: user._id,
            type,
            tonAmount: item.tonPrice,
            bocHash: boc,
            status: 'confirmed', // We trust TON Connect's on-chain confirmation
            confirmedAt: new Date()
        });
        await purchase.save();

        // Apply the upgrade
        let result = {};

        switch (type) {
            case 'energy_boost':
                user.maxEnergy += 2000;
                user.energy += 2000;
                await user.save();
                result = {
                    energy: user.energy,
                    maxEnergy: user.maxEnergy
                };
                break;

            case 'turbo_unlock':
            case 'super_unlock':
            case 'nitro_unlock':
                const modeToUnlock = item.unlocks;
                if (!user.unlockedModes.includes(modeToUnlock)) {
                    user.unlockedModes.push(modeToUnlock);
                    await user.save();
                }
                result = {
                    unlockedModes: user.unlockedModes
                };
                break;
        }

        res.json({
            success: true,
            purchase: {
                id: purchase._id,
                type: purchase.type,
                tonAmount: purchase.tonAmount,
                status: purchase.status
            },
            ...result
        });
    } catch (error) {
        console.error('Purchase error:', error);
        res.status(500).json({ error: 'Purchase failed' });
    }
});

// GET /api/shop/purchases - Get user's purchase history
router.get('/purchases', auth, async (req, res) => {
    try {
        const purchases = await Purchase.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .limit(50);

        res.json({
            purchases: purchases.map(p => ({
                id: p._id,
                type: p.type,
                tonAmount: p.tonAmount,
                status: p.status,
                createdAt: p.createdAt
            }))
        });
    } catch (error) {
        console.error('Purchases error:', error);
        res.status(500).json({ error: 'Failed to get purchases' });
    }
});

// POST /api/shop/connect-wallet - Save user's connected wallet address
router.post('/connect-wallet', auth, async (req, res) => {
    try {
        const { walletAddress } = req.body;
        if (!walletAddress) {
            return res.status(400).json({ error: 'Wallet address required' });
        }

        req.user.tonWalletAddress = walletAddress;
        await req.user.save();

        res.json({ success: true, walletAddress });
    } catch (error) {
        console.error('Connect wallet error:', error);
        res.status(500).json({ error: 'Failed to save wallet' });
    }
});

module.exports = router;
