import { useState, useEffect, useCallback } from 'react';
import { useUser } from '../context/UserContext';
import { getCurrentBlock, startMining, getLastBlocks } from '../api';

export default function MiningPage() {
    const { user, updateUser } = useUser();
    const [block, setBlock] = useState(null);
    const [lastBlocks, setLastBlocks] = useState([]);
    const [mining, setMining] = useState(false);
    const [miningResult, setMiningResult] = useState(null);
    const [selectedMode, setSelectedMode] = useState('basic');

    const modes = [
        { id: 'basic', label: 'Basic', cost: 100, multiplier: '1x' },
        { id: 'turbo', label: 'Turbo', cost: 200, multiplier: '2x' },
        { id: 'super', label: 'Super', cost: 400, multiplier: '4x' },
        { id: 'nitro', label: 'Nitro', cost: 800, multiplier: '8x' }
    ];

    const fetchBlockData = useCallback(async () => {
        try {
            const [blockRes, blocksRes] = await Promise.all([
                getCurrentBlock(),
                getLastBlocks()
            ]);
            setBlock(blockRes.data);
            setLastBlocks(blocksRes.data.blocks || []);
        } catch (err) {
            console.error('Failed to fetch block data:', err);
        }
    }, []);

    useEffect(() => {
        fetchBlockData();
        const interval = setInterval(fetchBlockData, 15000);
        return () => clearInterval(interval);
    }, [fetchBlockData]);

    const handleMine = async () => {
        if (mining) return;
        const modeConfig = modes.find(m => m.id === selectedMode);
        if (!user || user.energy < modeConfig.cost) return;

        setMining(true);
        setMiningResult(null);

        try {
            const res = await startMining(selectedMode);
            setMiningResult(res.data);
            updateUser(res.data.newBalance);
            if (res.data.block) {
                setBlock(prev => ({ ...prev, ...res.data.block }));
            }
            // Refresh blocks after mining
            setTimeout(fetchBlockData, 1000);
        } catch (err) {
            const msg = err.response?.data?.error || 'Mining failed';
            setMiningResult({ error: msg });
        } finally {
            setMining(false);
        }
    };

    const currentMode = modes.find(m => m.id === selectedMode);
    const canMine = user && user.energy >= currentMode.cost;

    return (
        <div className="page mining-page">
            <div className="section-title">
                <span className="title-icon">⛏️</span>
                Information
            </div>

            {/* Energy & Token Overview */}
            <div className="info-card">
                <div className="info-row">
                    <span className="info-label">Energy</span>
                    <div className="energy-bar-container">
                        <div className="energy-bar">
                            <div
                                className="energy-fill"
                                style={{ width: `${user ? (user.energy / user.maxEnergy) * 100 : 0}%` }}
                            />
                        </div>
                    </div>
                    <span className="info-value">{user?.energy?.toLocaleString() || 0}</span>
                </div>
                <div className="info-row">
                    <span className="info-label">My tokens</span>
                    <span className="info-value token-value">{user?.tokens?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}</span>
                </div>
            </div>

            {/* Block Info */}
            {block && (
                <div className="info-card block-info-card">
                    <div className="block-grid">
                        <div className="block-item">
                            <span className="block-label">Block</span>
                            <span className="block-value highlight">#{block.blockNumber?.toLocaleString()}</span>
                        </div>
                        <div className="block-item">
                            <span className="block-label">Difficulty</span>
                            <span className="block-value">{block.difficulty?.toLocaleString()}</span>
                        </div>
                        <div className="block-item">
                            <span className="block-label">Reward</span>
                            <span className="block-value">{block.reward?.toLocaleString()}</span>
                        </div>
                        <div className="block-item">
                            <span className="block-label">Online</span>
                            <span className="block-value highlight">{block.onlineMiners}</span>
                        </div>
                        <div className="block-item">
                            <span className="block-label">Status</span>
                            <span className={`block-value status-badge ${block.status}`}>{block.status}</span>
                        </div>
                        <div className="block-item">
                            <span className="block-label">Shares</span>
                            <span className="block-value">{block.totalShares}</span>
                        </div>
                        <div className="block-item">
                            <span className="block-label">Hashes</span>
                            <span className="block-value">{block.totalHashes}</span>
                        </div>
                        <div className="block-item">
                            <span className="block-label">Profit</span>
                            <span className="block-value">{miningResult?.tokensEarned?.toFixed(2) || '0'}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Mining Mode Selection */}
            <div className="mode-selector">
                {modes.map(mode => (
                    <button
                        key={mode.id}
                        className={`mode-btn ${selectedMode === mode.id ? 'active' : ''} ${user?.energy < mode.cost ? 'disabled' : ''}`}
                        onClick={() => setSelectedMode(mode.id)}
                        disabled={user?.energy < mode.cost}
                    >
                        {mode.label}
                        <span className="mode-cost">{mode.cost}⚡</span>
                    </button>
                ))}
            </div>

            {/* Start Mining Button */}
            <button
                className={`mine-btn ${mining ? 'mining-active' : ''} ${!canMine ? 'disabled' : ''}`}
                onClick={handleMine}
                disabled={!canMine || mining}
            >
                {mining ? (
                    <span className="mining-spinner">
                        <span className="spinner"></span> Mining...
                    </span>
                ) : (
                    'Start Mining'
                )}
            </button>

            {/* Mining Result Toast */}
            {miningResult && !miningResult.error && (
                <div className="mining-result success">
                    <span className="result-icon">🎉</span>
                    +{miningResult.tokensEarned?.toFixed(2)} XNH
                    <span className="result-mode">({miningResult.mode})</span>
                </div>
            )}
            {miningResult?.error && (
                <div className="mining-result error">
                    <span className="result-icon">⚠️</span>
                    {miningResult.error}
                </div>
            )}

            {/* Last Blocks */}
            <div className="section-title">
                <span className="title-icon">📦</span>
                Last blocks
            </div>
            <div className="last-blocks">
                {lastBlocks.length === 0 ? (
                    <div className="empty-state">No blocks mined yet. Be the first!</div>
                ) : (
                    lastBlocks.map((b, i) => (
                        <div key={i} className="block-row">
                            <div className="block-row-left">
                                <span className="block-number">#{b.blockNumber?.toLocaleString()}</span>
                                <span className="block-miner">{b.minedBy}</span>
                            </div>
                            <div className="block-row-right">
                                <span className="block-reward">+{b.reward}</span>
                                <span className="block-shares">{b.totalShares} shares</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
