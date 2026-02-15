const mongoose = require('mongoose');

const blockSchema = new mongoose.Schema({
    blockNumber: {
        type: Number,
        required: true,
        unique: true,
        index: true
    },
    difficulty: {
        type: Number,
        default: 84500
    },
    reward: {
        type: Number,
        default: 1100
    },
    status: {
        type: String,
        enum: ['waiting', 'mining', 'completed'],
        default: 'waiting'
    },
    minedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    onlineMiners: {
        type: Number,
        default: 0
    },
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

module.exports = mongoose.model('Block', blockSchema);
