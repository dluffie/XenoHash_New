const express = require('express');
const auth = require('../middleware/auth');
const TaskCompletion = require('../models/TaskCompletion');

const router = express.Router();

// Task definitions
const TASKS = {
    daily: [
        { id: 'daily_login', name: 'Daily Login', description: 'Log in to XenoHash today', reward: 100, icon: '🔑' },
        { id: 'daily_mine_3', name: 'Mine 3 Times', description: 'Complete 3 mining sessions', reward: 200, icon: '⛏️' },
        { id: 'daily_share_story', name: 'Share to Story', description: 'Share XenoHash to your story', reward: 150, icon: '📱' },
        { id: 'daily_max_energy', name: 'Max Energy', description: 'Reach maximum energy level', reward: 100, icon: '⚡' },
        { id: 'daily_invite', name: 'Invite a Friend', description: 'Send an invite to a friend today', reward: 300, icon: '👥' }
    ],
    general: [
        { id: 'gen_join_channel', name: 'Join Telegram Channel', description: 'Join our official Telegram channel', reward: 500, icon: '📢' },
        { id: 'gen_join_chat', name: 'Join Telegram Chat', description: 'Join our community chat group', reward: 500, icon: '💬' },
        { id: 'gen_follow_twitter', name: 'Follow on X (Twitter)', description: 'Follow XenoHash on X', reward: 500, icon: '🐦' },
        { id: 'gen_connect_wallet', name: 'Connect Wallet', description: 'Connect your TON wallet', reward: 1000, icon: '💎' },
        { id: 'gen_first_mine', name: 'First Mining', description: 'Complete your first mining session', reward: 200, icon: '🎯' },
        { id: 'gen_invite_3', name: 'Invite 3 Friends', description: 'Invite 3 friends to XenoHash', reward: 1000, icon: '🤝' },
        { id: 'gen_mine_50', name: 'Mine 50 Times', description: 'Complete 50 mining sessions', reward: 2000, icon: '🏆' },
        { id: 'gen_earn_10k', name: 'Earn 10,000 Tokens', description: 'Accumulate 10,000 tokens total', reward: 1500, icon: '💰' }
    ]
};

// Helper: Get today's start for daily task checking
function getTodayStart() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// GET /api/tasks - List all tasks with completion status
router.get('/', auth, async (req, res) => {
    try {
        const userId = req.user._id;
        const todayStart = getTodayStart();

        // Get all completions for this user
        const completions = await TaskCompletion.find({ userId });

        // Build completion map
        const completionMap = {};
        completions.forEach(c => {
            if (!completionMap[c.taskId]) {
                completionMap[c.taskId] = [];
            }
            completionMap[c.taskId].push(c.completedAt);
        });

        // Check daily tasks (only today's completions count)
        const dailyTasks = TASKS.daily.map(task => {
            const taskCompletions = completionMap[task.id] || [];
            const completedToday = taskCompletions.some(date => new Date(date) >= todayStart);
            return { ...task, completed: completedToday };
        });

        // Check general tasks (one-time)
        const generalTasks = TASKS.general.map(task => {
            const completed = (completionMap[task.id] || []).length > 0;
            return { ...task, completed };
        });

        res.json({ daily: dailyTasks, general: generalTasks });
    } catch (error) {
        console.error('Tasks error:', error);
        res.status(500).json({ error: 'Failed to get tasks' });
    }
});

// POST /api/tasks/complete - Complete a task
router.post('/complete', auth, async (req, res) => {
    try {
        const { taskId } = req.body;
        const userId = req.user._id;

        if (!taskId) {
            return res.status(400).json({ error: 'taskId is required' });
        }

        // Find task definition
        const allTasks = [...TASKS.daily, ...TASKS.general];
        const task = allTasks.find(t => t.id === taskId);

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Check if already completed
        const taskType = TASKS.daily.find(t => t.id === taskId) ? 'daily' : 'general';

        if (taskType === 'daily') {
            const todayStart = getTodayStart();
            const alreadyDone = await TaskCompletion.findOne({
                userId,
                taskId,
                completedAt: { $gte: todayStart }
            });
            if (alreadyDone) {
                return res.status(400).json({ error: 'Task already completed today' });
            }
        } else {
            const alreadyDone = await TaskCompletion.findOne({ userId, taskId });
            if (alreadyDone) {
                return res.status(400).json({ error: 'Task already completed' });
            }
        }

        // Create completion record
        const completion = new TaskCompletion({
            userId,
            taskId,
            taskType,
            reward: task.reward
        });

        // Award tokens
        req.user.tokens += task.reward;

        await Promise.all([completion.save(), req.user.save()]);

        res.json({
            success: true,
            taskId,
            reward: task.reward,
            newTokenBalance: req.user.tokens
        });
    } catch (error) {
        console.error('Complete task error:', error);
        res.status(500).json({ error: 'Failed to complete task' });
    }
});

module.exports = router;
