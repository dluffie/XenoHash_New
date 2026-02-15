import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authTelegram, getProfile } from '../api';
import api from '../api';

const UserContext = createContext(null);

export function UserProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const authenticate = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // First check if server is reachable
            try {
                const healthRes = await api.get('/health');
                console.log('Server health:', healthRes.data);
            } catch (healthErr) {
                console.error('Server unreachable:', healthErr);
                setError(`Server unreachable: ${healthErr.message}`);
                setLoading(false);
                return;
            }

            const tg = window.Telegram?.WebApp;

            if (tg && tg.initData) {
                // Real Telegram environment
                tg.ready();
                tg.expand();
                try { tg.requestFullscreen?.(); } catch (e) { }
                try { tg.disableVerticalSwipes?.(); } catch (e) { }
                tg.setHeaderColor('#0a0a1a');
                tg.setBackgroundColor('#0a0a1a');
                tg.isClosingConfirmationEnabled = true;

                // Check for referral code in start_param
                const startParam = tg.initDataUnsafe?.start_param || '';

                console.log('Authenticating with Telegram initData...');
                const response = await authTelegram(tg.initData, startParam);
                setUser(response.data.user);
            } else {
                setError('Please open this app from Telegram');
            }
        } catch (err) {
            console.error('Auth error:', err);
            const detail = err.response?.data?.error || err.message || 'Unknown error';
            const status = err.response?.status || 'No response';
            setError(`Auth failed (${status}): ${detail}`);
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
