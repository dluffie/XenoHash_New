const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// Validate Telegram WebApp initData
function validateTelegramData(initData, botToken) {
    try {
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        urlParams.delete('hash');

        // Sort params alphabetically
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

        return calculatedHash === hash;
    } catch (error) {
        console.error('Telegram validation error:', error);
        return false;
    }
}

// POST /api/auth/telegram - Authenticate via Telegram WebApp
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

        // Validate with bot token (skip in dev if no token set)
        if (process.env.BOT_TOKEN && process.env.BOT_TOKEN !== 'your_telegram_bot_token_here') {
            const isValid = validateTelegramData(initData, process.env.BOT_TOKEN);
            if (!isValid) {
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
                    referrer.tokens += 500; // Signup bonus for referrer
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

        // Generate JWT
        const token = jwt.sign(
            { userId: user._id, telegramId: user.telegramId },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            token,
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

// POST /api/auth/dev - Development auth (for testing without Telegram)
router.post('/dev', async (req, res) => {
    try {
        const { telegramId, username, referralCode } = req.body;

        if (!telegramId) {
            return res.status(400).json({ error: 'telegramId is required' });
        }

        let user = await User.findOne({ telegramId: String(telegramId) });
        let isNewUser = false;

        if (!user) {
            isNewUser = true;
            user = new User({
                telegramId: String(telegramId),
                username: username || `user_${telegramId}`,
                firstName: username || 'Dev',
                lastName: 'User',
                energy: 2000,
                maxEnergy: 2000,
                tokens: 0
            });

            if (referralCode) {
                const referrer = await User.findOne({ referralCode });
                if (referrer && referrer.telegramId !== String(telegramId)) {
                    user.referredBy = referralCode;
                    referrer.referralCount += 1;
                    referrer.tokens += 500;
                    referrer.referralEarnings += 500;
                    await referrer.save();
                }
            }

            await user.save();
        } else {
            user.regenerateEnergy();
            await user.save();
        }

        const token = jwt.sign(
            { userId: user._id, telegramId: user.telegramId },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            token,
            user: {
                id: user._id,
                telegramId: user.telegramId,
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
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
        console.error('Dev auth error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
});

module.exports = router;
