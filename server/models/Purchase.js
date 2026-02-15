const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['energy_boost', 'turbo_unlock', 'super_unlock', 'nitro_unlock'],
        required: true
    },
    tonAmount: {
        type: Number,
        required: true
    },
    // BOC (bag of cells) from TON Connect transaction
    bocHash: {
        type: String,
        default: null
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'failed'],
        default: 'pending'
    },
    confirmedAt: {
        type: Date,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Purchase', purchaseSchema);
