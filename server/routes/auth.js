const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');

const router = express.Router();

// POST /api/auth/telegram - Authenticate via Telegram WebApp
// Returns user data (no JWT — Telegram initData is the auth)
router.post('/telegram', async (req, res) => {
    try {
        const { initData, referralCode } = req.body;

        if (!initData) {
            return res.status(400).json({ error: 'initData is required' });
        }

        // Parse user data from initData
        const urlParams = new URLSearchParams(initData);
        const userDataStr = urlParams.get('user');

        if (!userDataStr) {
            return res.status(400).json({ error: 'User data not found in initData' });
        }

        const telegramUser = JSON.parse(decodeURIComponent(userDataStr));

        // Validate hash with bot token
        const botToken = process.env.BOT_TOKEN;
        if (botToken && botToken !== 'your_telegram_bot_token_here') {
            const hash = urlParams.get('hash');
            urlParams.delete('hash');

            const dataCheckString = Array.from(urlParams.entries())
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, value]) => `${key}=${value}`)
                .join('\n');

            const secretKey = crypto
                .createHmac('sha256', 'WebAppData')
                .update(botToken)
                .digest();

            const calculatedHash = crypto
                .createHmac('sha256', secretKey)
                .update(dataCheckString)
                .digest('hex');

            if (calculatedHash !== hash) {
                return res.status(401).json({ error: 'Invalid Telegram data' });
            }
        }

        // Find or create user
        let user = await User.findOne({ telegramId: String(telegramUser.id) });
        let isNewUser = false;

        if (!user) {
            isNewUser = true;
            user = new User({
                telegramId: String(telegramUser.id),
                username: telegramUser.username || '',
                firstName: telegramUser.first_name || '',
                lastName: telegramUser.last_name || '',
                photoUrl: telegramUser.photo_url || '',
                energy: 2000,
                maxEnergy: 2000,
                tokens: 0
            });

            // Handle referral
            if (referralCode) {
                const referrer = await User.findOne({ referralCode });
                if (referrer && referrer.telegramId !== String(telegramUser.id)) {
                    user.referredBy = referralCode;
                    referrer.referralCount += 1;
                    referrer.tokens += 500;
                    referrer.referralEarnings += 500;
                    await referrer.save();
                }
            }

            await user.save();
        } else {
            // Update profile info on each login
            user.username = telegramUser.username || user.username;
            user.firstName = telegramUser.first_name || user.firstName;
            user.lastName = telegramUser.last_name || user.lastName;
            user.photoUrl = telegramUser.photo_url || user.photoUrl;
            user.regenerateEnergy();
            await user.save();
        }

        res.json({
            user: {
                id: user._id,
                telegramId: user.telegramId,
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                photoUrl: user.photoUrl,
                energy: user.energy,
                maxEnergy: user.maxEnergy,
                tokens: user.tokens,
                totalMined: user.totalMined,
                miningSessionsCount: user.miningSessionsCount,
                referralCode: user.referralCode,
                referralCount: user.referralCount,
                referralEarnings: user.referralEarnings,
                isNewUser
            }
        });
    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
});

module.exports = router;
