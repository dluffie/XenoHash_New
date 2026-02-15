const mongoose = require('mongoose');

const supplyTrackerSchema = new mongoose.Schema({
    totalMinted: {
        type: Number,
        default: 0
    },
    maxSupply: {
        type: Number,
        default: 1_000_000_000 // 1 Billion XNH
    },
    lastBlockNumber: {
        type: Number,
        default: 0
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

/**
 * Get or create the singleton supply tracker
 */
supplyTrackerSchema.statics.getInstance = async function () {
    let tracker = await this.findOne();
    if (!tracker) {
        tracker = await this.create({});
    }
    return tracker;
};

/**
 * Check if more tokens can be minted
 */
supplyTrackerSchema.methods.canMint = function (amount) {
    return (this.totalMinted + amount) <= this.maxSupply;
};

/**
 * Record minted tokens
 */
supplyTrackerSchema.methods.recordMint = function (amount, blockNumber) {
    this.totalMinted += amount;
    this.lastBlockNumber = blockNumber;
    this.updatedAt = new Date();
    return this;
};

module.exports = mongoose.model('SupplyTracker', supplyTrackerSchema);
