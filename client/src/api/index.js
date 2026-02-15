import axios from 'axios';

// In production (Render), API is on same origin. In dev, proxy handles it.
const API_BASE = import.meta.env.VITE_API_URL || '';

const api = axios.create({
    baseURL: `${API_BASE}/api`,
    headers: { 'Content-Type': 'application/json' }
});

// Attach Telegram initData on every request
api.interceptors.request.use((config) => {
    const tg = window.Telegram?.WebApp;
    if (tg && tg.initData) {
        config.headers['X-Telegram-Init-Data'] = tg.initData;
    }
    return config;
});

// Auth
export const authTelegram = (initData, referralCode) =>
    api.post('/auth/telegram', { initData, referralCode });

// User
export const getProfile = () => api.get('/user/profile');
export const getStats = () => api.get('/user/stats');
export const regenEnergy = () => api.post('/user/energy/regen');
export const increaseEnergy = () => api.post('/user/energy/increase');
export const updateUsername = (username) => api.put('/user/username', { username });

// Mining — PoW system
export const getCurrentBlock = () => api.get('/mining/block');
export const joinMining = (mode) => api.post('/mining/join', { mode });
export const miningTick = () => api.post('/mining/tick');
export const submitHash = (hash, nonce) => api.post('/mining/submit', { hash, nonce });
export const leaveMining = () => api.post('/mining/leave');
export const getMiningStatus = () => api.get('/mining/status');
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

// Shop / TON payments
export const getShopItems = () => api.get('/shop/items');
export const purchaseItem = (type, boc) => api.post('/shop/purchase', { type, boc });
export const getShopPurchases = () => api.get('/shop/purchases');
export const connectWallet = (walletAddress) => api.post('/shop/connect-wallet', { walletAddress });

export default api;
