const mongoose = require('mongoose');

const miningActivitySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    blockId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Block',
        required: true
    },
    mode: {
        type: String,
        enum: ['basic', 'turbo', 'super', 'nitro'],
        required: true
    },
    energyConsumed: {
        type: Number,
        required: true
    },
    tokensEarned: {
        type: Number,
        required: true
    },
    // PoW specific fields
    hashSubmitted: {
        type: String,
        default: null
    },
    nonceUsed: {
        type: Number,
        default: null
    },
    isBlockFinder: {
        type: Boolean,
        default: false
    },
    // Pool share reward (subset of tokensEarned for non-finders)
    shareReward: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('MiningActivity', miningActivitySchema);
