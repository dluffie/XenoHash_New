const crypto = require('crypto');
const User = require('../models/User');

// Validate Telegram WebApp initData and extract user
const auth = async (req, res, next) => {
    try {
        const initData = req.header('X-Telegram-Init-Data');

        if (!initData) {
            return res.status(401).json({ error: 'Telegram initData required' });
        }

        // Parse user data from initData
        const urlParams = new URLSearchParams(initData);
        const userDataStr = urlParams.get('user');

        if (!userDataStr) {
            return res.status(401).json({ error: 'User data not found' });
        }

        const telegramUser = JSON.parse(decodeURIComponent(userDataStr));

        // Validate hash with bot token (skip if no valid token configured)
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

        if (!user) {
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
            await user.save();
        } else {
            // Update profile + regenerate energy
            user.username = telegramUser.username || user.username;
            user.firstName = telegramUser.first_name || user.firstName;
            user.lastName = telegramUser.last_name || user.lastName;
            user.regenerateEnergy();
            await user.save();
        }

        req.user = user;
        req.telegramUser = telegramUser;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(401).json({ error: 'Authentication failed' });
    }
};

module.exports = auth;
