import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
    baseURL: `${API_BASE}/api`,
    headers: { 'Content-Type': 'application/json' }
});

// Auto-attach JWT token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('xenohash_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Auth
export const authTelegram = (initData, referralCode) =>
    api.post('/auth/telegram', { initData, referralCode });

export const authDev = (telegramId, username, referralCode) =>
    api.post('/auth/dev', { telegramId, username, referralCode });

// User
export const getProfile = () => api.get('/user/profile');
export const getStats = () => api.get('/user/stats');
export const regenEnergy = () => api.post('/user/energy/regen');
export const increaseEnergy = () => api.post('/user/energy/increase');
export const updateUsername = (username) => api.put('/user/username', { username });

// Mining
export const getCurrentBlock = () => api.get('/mining/block');
export const startMining = (mode) => api.post('/mining/start', { mode });
export const getMiningHistory = (page = 1) => api.get(`/mining/history?page=${page}`);
export const getLastBlocks = () => api.get('/mining/last-blocks');
export const getMiningModes = () => api.get('/mining/modes');

// Tasks
export const getTasks = () => api.get('/tasks');
export const completeTask = (taskId) => api.post('/tasks/complete', { taskId });

// Referrals
export const getReferralInfo = () => api.get('/referrals');
export const getReferralList = () => api.get('/referrals/list');

// Leaderboard
export const getLeaderboard = () => api.get('/leaderboard');

export default api;
