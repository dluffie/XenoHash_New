import { useState, useEffect } from 'react';
import { useTonConnectUI, useTonAddress } from '@tonconnect/ui-react';
import { useUser } from '../context/UserContext';
import { getShopItems, purchaseItem, connectWallet } from '../api';

// Helper to safely convert TON to nanoTON (simple multiplication for now)
const toNano = (amount) => Math.floor(amount * 1000000000).toString();

export default function ServicePage() {
    const { user, updateUser, refreshUser } = useUser();
    const [tonConnectUI] = useTonConnectUI();
    const tonAddress = useTonAddress();

    const [shopItems, setShopItems] = useState([]);
    const [walletAddress, setWalletAddress] = useState(null); // Receiving wallet
    const [purchasing, setPurchasing] = useState(null);
    const [message, setMessage] = useState(null);
    const [selectedMode, setSelectedMode] = useState('basic');

    // Fetch shop items
    useEffect(() => {
        loadShopItems();
    }, []);

    // Save wallet address to server when connected
    useEffect(() => {
        if (tonAddress) {
            connectWallet(tonAddress).catch(console.error);
        }
    }, [tonAddress]);

    const loadShopItems = async () => {
        try {
            const res = await getShopItems();
            setShopItems(res.data.items || []);
            setWalletAddress(res.data.walletAddress);
        } catch (err) {
            console.error('Failed to load shop:', err);
        }
    };

    const handlePurchase = async (itemId) => {
        if (purchasing) return;

        const item = shopItems.find(i => i.id === itemId);
        if (!item) return;

        if (!tonAddress) {
            // Prompt wallet connection
            try {
                await tonConnectUI.openModal();
            } catch (err) {
                setMessage({ type: 'error', text: 'Please connect your wallet first' });
            }
            return;
        }

        if (!walletAddress) {
            setMessage({ type: 'error', text: 'Shop wallet not configured. Contact admin.' });
            return;
        }

        setPurchasing(itemId);
        setMessage(null);

        try {
            // Send TON transaction via TON Connect
            const transaction = {
                validUntil: Math.floor(Date.now() / 1000) + 600, // 10 min
                messages: [
                    {
                        address: walletAddress,
                        amount: toNano(item.tonPrice)
                    }
                ]
            };

            const result = await tonConnectUI.sendTransaction(transaction);

            // Transaction sent — notify server with BOC
            const boc = result.boc;
            const res = await purchaseItem(itemId, boc);

            if (res.data.success) {
                // Update user data
                if (res.data.energy !== undefined) {
                    updateUser({
                        energy: res.data.energy,
                        maxEnergy: res.data.maxEnergy
                    });
                }
                if (res.data.unlockedModes) {
                    updateUser({ unlockedModes: res.data.unlockedModes });
                }

                setMessage({ type: 'success', text: `✅ ${item.label} purchased successfully!` });

                // Refresh shop items
                loadShopItems();
                refreshUser();
            }
        } catch (err) {
            console.error('Purchase error:', err);
            if (err?.message?.includes('User rejected')) {
                setMessage({ type: 'error', text: 'Transaction cancelled by user' });
            } else {
                const errMsg = err.response?.data?.error || err.message || 'Purchase failed';
                setMessage({ type: 'error', text: errMsg });
            }
        } finally {
            setPurchasing(null);
        }
    };

    const handleConnectWallet = async () => {
        try {
            if (tonAddress) {
                await tonConnectUI.disconnect();
            } else {
                await tonConnectUI.openModal();
            }
        } catch (err) {
            console.error('Wallet connection error:', err);
        }
    };

    const energyPercent = user ? (user.energy / user.maxEnergy) * 100 : 0;

    const modes = [
        { id: 'basic', label: 'Basic', cost: 10, multiplier: '1x', description: 'Standard mining power with lowest energy cost' },
        { id: 'turbo', label: 'Turbo', cost: 20, multiplier: '2x', description: '2x mining power — double the hashrate' },
        { id: 'super', label: 'Super', cost: 40, multiplier: '4x', description: '4x mining power for serious miners' },
        { id: 'nitro', label: 'Nitro', cost: 80, multiplier: '8x', description: 'Maximum power! 8x hashrate' }
    ];

    return (
        <div className="page service-page">
            {/* Energy Section */}
            <div className="section-title">
                <span className="title-icon">⚡</span>
                Energy
            </div>

            <div className="info-card energy-card">
                <div className="info-row">
                    <span className="info-label">Energy</span>
                    <div className="energy-bar-container">
                        <div className="energy-bar">
                            <div className="energy-fill" style={{ width: `${energyPercent}%` }} />
                        </div>
                    </div>
                    <span className="info-value">{user?.energy?.toLocaleString() || 0}</span>
                </div>
                <div className="info-row">
                    <span className="info-label">Max energy</span>
                    <span className="info-value">{user?.maxEnergy?.toLocaleString() || 0}</span>
                </div>
            </div>

            {/* Shop Items */}
            <div className="section-title" style={{ marginTop: '1.5rem' }}>
                <span className="title-icon">🛒</span>
                Shop
            </div>

            <div className="shop-grid">
                {shopItems.map(item => (
                    <div key={item.id} className={`shop-item ${item.purchased ? 'purchased' : ''}`}>
                        <div className="shop-item-header">
                            <span className="shop-item-icon">{item.icon}</span>
                            <span className="shop-item-name">{item.label}</span>
                        </div>
                        <p className="shop-item-desc">{item.description}</p>
                        <div className="shop-item-footer">
                            <span className="shop-item-price">💎 {item.tonPrice} TON</span>
                            <button
                                className={`shop-buy-btn ${purchasing === item.id ? 'loading' : ''} ${item.purchased ? 'purchased' : ''}`}
                                onClick={() => handlePurchase(item.id)}
                                disabled={purchasing || item.purchased}
                            >
                                {item.purchased ? '✅ Owned' :
                                    purchasing === item.id ? 'Processing...' :
                                        !tonAddress ? '🔗 Connect & Buy' : 'Buy'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Message Toast */}
            {
                message && (
                    <div className={`toast-message ${message.type}`}>
                        {message.text}
                    </div>
                )
            }

            {/* Mining Mode Preview */}
            <div className="section-title" style={{ marginTop: '1.5rem' }}>
                <span className="title-icon">⛏️</span>
                Mining Modes
            </div>

            <div className="mode-tabs">
                {modes.map(mode => {
                    const isLocked = user?.unlockedModes && !user.unlockedModes.includes(mode.id);
                    return (
                        <button
                            key={mode.id}
                            className={`mode-tab ${selectedMode === mode.id ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
                            onClick={() => setSelectedMode(mode.id)}
                        >
                            {mode.label}
                            {isLocked && <span className="lock-icon">🔒</span>}
                        </button>
                    );
                })}
            </div>

            {
                (() => {
                    const mode = modes.find(m => m.id === selectedMode);
                    const isLocked = user?.unlockedModes && !user.unlockedModes.includes(mode.id);
                    return (
                        <div className="info-card mode-detail-card">
                            <div className="mode-detail-header">
                                <h3>{mode.label} Mode</h3>
                                <span className="multiplier-badge">{mode.multiplier}</span>
                            </div>
                            <p className="mode-description">{mode.description}</p>
                            <div className="mode-stats">
                                <div className="mode-stat">
                                    <span className="stat-label">Energy/Tick</span>
                                    <span className="stat-value">{mode.cost} ⚡</span>
                                </div>
                                <div className="mode-stat">
                                    <span className="stat-label">Multiplier</span>
                                    <span className="stat-value">{mode.multiplier}</span>
                                </div>
                            </div>
                            {isLocked && (
                                <div className="unlock-requirement">
                                    🔒 Purchase this mode for 0.5 TON above
                                </div>
                            )}
                        </div>
                    );
                })()
            }

            <p className="mining-power-note">
                Higher modes increase your hashrate by the multiplier shown. Energy drains faster with higher modes.
            </p>
        </div >
    );
}
