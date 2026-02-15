const mongoose = require('mongoose');

const blockSchema = new mongoose.Schema({
    blockNumber: {
        type: Number,
        required: true,
        unique: true,
        index: true
    },
    targetDifficulty: {
        type: Number,
        default: 4 // Number of leading zeros required
    },
    reward: {
        type: Number,
        default: 1000 // Calculated from halving formula
    },
    era: {
        type: Number,
        default: 0 // Halving era = floor(blockNumber / 100)
    },
    status: {
        type: String,
        enum: ['waiting', 'mining', 'completed'],
        default: 'waiting'
    },
    // Who found the winning hash
    minedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    winningHash: {
        type: String,
        default: null
    },
    winningNonce: {
        type: Number,
        default: null
    },
    // Active miners in the pool for this block
    activeMiners: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        telegramId: String,
        joinedAt: {
            type: Date,
            default: Date.now
        },
        lastTick: {
            type: Date,
            default: Date.now
        },
        mode: {
            type: String,
            enum: ['basic', 'turbo', 'super', 'nitro'],
            default: 'basic'
        }
    }],
    totalShares: {
        type: Number,
        default: 0
    },
    totalHashes: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    completedAt: {
        type: Date,
        default: null
    }
});

// Virtual: number of online miners
blockSchema.virtual('onlineMiners').get(function () {
    return this.activeMiners ? this.activeMiners.length : 0;
});

// Ensure virtuals are included in JSON
blockSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Block', blockSchema);
