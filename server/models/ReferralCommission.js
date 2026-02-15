const mongoose = require('mongoose');

const referralCommissionSchema = new mongoose.Schema({
    referrerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    referredUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    commission: {
        type: Number,
        required: true
    },
    source: {
        type: String,
        enum: ['signup', 'mining'],
        default: 'mining'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('ReferralCommission', referralCommissionSchema);
