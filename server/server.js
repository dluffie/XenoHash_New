const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const Block = require('./models/Block');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/mining', require('./routes/mining'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/referrals', require('./routes/referrals'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/user', require('./routes/user'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// --- Serve React frontend in production ---
const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientBuildPath));

// All non-API routes → serve React index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// Seed initial block if needed
async function seedInitialBlock() {
    try {
        const blockCount = await Block.countDocuments();
        if (blockCount === 0) {
            const block = new Block({
                blockNumber: 1,
                difficulty: 84500,
                reward: 1100,
                status: 'waiting',
                onlineMiners: Math.floor(Math.random() * 100) + 50
            });
            await block.save();
            console.log('✅ Initial block created');
        }
    } catch (error) {
        console.error('Seed error:', error);
    }
}

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        console.log('✅ Connected to MongoDB');
        await seedInitialBlock();
        app.listen(PORT, () => {
            console.log(`🚀 XenoHash server running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('❌ MongoDB connection error:', err);
        process.exit(1);
    });
