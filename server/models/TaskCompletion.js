const mongoose = require('mongoose');

const taskCompletionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    taskId: {
        type: String,
        required: true
    },
    taskType: {
        type: String,
        enum: ['daily', 'general'],
        required: true
    },
    reward: {
        type: Number,
        required: true
    },
    completedAt: {
        type: Date,
        default: Date.now
    }
});

// Compound index for checking duplicates
taskCompletionSchema.index({ userId: 1, taskId: 1, completedAt: 1 });

module.exports = mongoose.model('TaskCompletion', taskCompletionSchema);
