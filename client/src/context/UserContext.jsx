import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authTelegram, authDev, getProfile } from '../api';

const UserContext = createContext(null);

export function UserProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const authenticate = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Check if running inside Telegram WebApp
            const tg = window.Telegram?.WebApp;
            let response;

            if (tg && tg.initData) {
                // Real Telegram auth
                tg.ready();
                tg.expand();

                // Check for referral code in start_param
                const startParam = tg.initDataUnsafe?.start_param || '';

                response = await authTelegram(tg.initData, startParam);
            } else {
                // Dev mode - use mock telegram ID
                const devId = localStorage.getItem('xenohash_dev_id') || String(Date.now());
                localStorage.setItem('xenohash_dev_id', devId);
                response = await authDev(devId, `dev_${devId.slice(-4)}`);
            }

            const { token, user: userData } = response.data;
            localStorage.setItem('xenohash_token', token);
            setUser(userData);
        } catch (err) {
            console.error('Auth error:', err);
            setError(err.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    }, []);

    const refreshUser = useCallback(async () => {
        try {
            const response = await getProfile();
            setUser(response.data);
        } catch (err) {
            console.error('Refresh error:', err);
        }
    }, []);

    const updateUser = useCallback((updates) => {
        setUser(prev => prev ? { ...prev, ...updates } : null);
    }, []);

    useEffect(() => {
        authenticate();
    }, [authenticate]);

    // Energy regeneration timer (update display every 60s)
    useEffect(() => {
        if (!user) return;
        const interval = setInterval(() => {
            setUser(prev => {
                if (!prev || prev.energy >= prev.maxEnergy) return prev;
                return { ...prev, energy: Math.min(prev.energy + 1, prev.maxEnergy) };
            });
        }, 60000);
        return () => clearInterval(interval);
    }, [user]);

    return (
        <UserContext.Provider value={{ user, loading, error, refreshUser, updateUser, authenticate }}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = useContext(UserContext);
    if (!context) throw new Error('useUser must be used within UserProvider');
    return context;
}
