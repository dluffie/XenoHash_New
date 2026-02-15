import { useState } from 'react';
import { useUser } from '../context/UserContext';
import { increaseEnergy } from '../api';

export default function ServicePage() {
    const { user, updateUser } = useUser();
    const [selectedMode, setSelectedMode] = useState('basic');
    const [upgrading, setUpgrading] = useState(false);
    const [message, setMessage] = useState(null);

    const modes = [
        { id: 'basic', label: 'Basic', cost: 100, multiplier: '1x', description: 'Standard mining power with lowest energy cost', unlocked: true },
        { id: 'turbo', label: 'Turbo', cost: 200, multiplier: '2x', description: '2x mining power for double the energy', unlocked: true },
        { id: 'super', label: 'Super', cost: 400, multiplier: '4x', description: '4x mining power for serious miners', unlocked: (user?.totalMined || 0) >= 5000, reqText: 'Mine 5,000 tokens' },
        { id: 'nitro', label: 'Nitro', cost: 800, multiplier: '8x', description: 'Maximum power! 8x rewards for 8x energy', unlocked: (user?.totalMined || 0) >= 20000, reqText: 'Mine 20,000 tokens' }
    ];

    const handleIncreaseEnergy = async () => {
        if (upgrading) return;
        setUpgrading(true);
        setMessage(null);
        try {
            const res = await increaseEnergy();
            updateUser(res.data);
            setMessage({ type: 'success', text: 'Max energy increased by +2000!' });
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to upgrade' });
        } finally {
            setUpgrading(false);
        }
    };

    const energyPercent = user ? (user.energy / user.maxEnergy) * 100 : 0;

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

            <p className="restore-text">
                Restore energy by completing tasks or using tokens ↓
            </p>

            <button
                className={`increase-btn ${upgrading ? 'loading' : ''}`}
                onClick={handleIncreaseEnergy}
                disabled={upgrading}
            >
                {upgrading ? 'Upgrading...' : 'Increase maximum energy +2000'}
            </button>

            <p className="cost-hint">Costs 1,000 XNH tokens</p>

            {message && (
                <div className={`toast-message ${message.type}`}>
                    {message.type === 'success' ? '✅' : '⚠️'} {message.text}
                </div>
            )}

            {/* Mining Mode Section */}
            <div className="section-title" style={{ marginTop: '2rem' }}>
                <span className="title-icon">⛏️</span>
                Mining mode
            </div>

            <div className="mode-tabs">
                {modes.map(mode => (
                    <button
                        key={mode.id}
                        className={`mode-tab ${selectedMode === mode.id ? 'active' : ''} ${!mode.unlocked ? 'locked' : ''}`}
                        onClick={() => mode.unlocked && setSelectedMode(mode.id)}
                    >
                        {mode.label}
                        {!mode.unlocked && <span className="lock-icon">🔒</span>}
                    </button>
                ))}
            </div>

            {/* Selected Mode Details */}
            {(() => {
                const mode = modes.find(m => m.id === selectedMode);
                return (
                    <div className="info-card mode-detail-card">
                        <div className="mode-detail-header">
                            <h3>{mode.label} Mode</h3>
                            <span className="multiplier-badge">{mode.multiplier}</span>
                        </div>
                        <p className="mode-description">{mode.description}</p>
                        <div className="mode-stats">
                            <div className="mode-stat">
                                <span className="stat-label">Energy Cost</span>
                                <span className="stat-value">{mode.cost} ⚡</span>
                            </div>
                            <div className="mode-stat">
                                <span className="stat-label">Multiplier</span>
                                <span className="stat-value">{mode.multiplier}</span>
                            </div>
                        </div>
                        {!mode.unlocked && (
                            <div className="unlock-requirement">
                                🔒 Requires: {mode.reqText}
                            </div>
                        )}
                    </div>
                );
            })()}

            <p className="mining-power-note">
                Your mining power can be increased by about 8 times using various modes.
                Please note that your device may heat up.
            </p>
        </div>
    );
}
