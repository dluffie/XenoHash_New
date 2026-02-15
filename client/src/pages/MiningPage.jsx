import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '../context/UserContext';
import { getCurrentBlock, joinMining, miningTick, submitHash, leaveMining, getLastBlocks } from '../api';

export default function MiningPage() {
    const { user, updateUser } = useUser();
    const [block, setBlock] = useState(null);
    const [lastBlocks, setLastBlocks] = useState([]);
    const [selectedMode, setSelectedMode] = useState('basic');

    // Mining state
    const [isMining, setIsMining] = useState(false);
    const [hashrate, setHashrate] = useState(0);
    const [noncesTried, setNoncesTried] = useState(0);
    const [elapsed, setElapsed] = useState(0);
    const [miningResult, setMiningResult] = useState(null);
    const [statusText, setStatusText] = useState('Ready to mine');

    // Refs for worker, tick interval, and avoiding stale closures
    const workerRef = useRef(null);
    const tickIntervalRef = useRef(null);
    const isMiningRef = useRef(false);
    const modeRef = useRef('basic');
    const startMiningBlockRef = useRef(null);

    const modes = [
        { id: 'basic', label: 'Basic', cost: 10, multiplier: '1x' },
        { id: 'turbo', label: 'Turbo', cost: 20, multiplier: '2x' },
        { id: 'super', label: 'Super', cost: 40, multiplier: '4x' },
        { id: 'nitro', label: 'Nitro', cost: 80, multiplier: '8x' }
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

    // Cleanup worker on unmount
    useEffect(() => {
        return () => {
            isMiningRef.current = false;
            if (workerRef.current) {
                workerRef.current.terminate();
                workerRef.current = null;
            }
            if (tickIntervalRef.current) {
                clearInterval(tickIntervalRef.current);
                tickIntervalRef.current = null;
            }
            leaveMining().catch(() => { });
        };
    }, []);

    const stopMining = useCallback(() => {
        isMiningRef.current = false;
        setIsMining(false);
        setStatusText('Mining stopped');

        // Terminate worker
        if (workerRef.current) {
            workerRef.current.postMessage({ type: 'stop' });
            workerRef.current.terminate();
            workerRef.current = null;
        }

        // Clear tick interval
        if (tickIntervalRef.current) {
            clearInterval(tickIntervalRef.current);
            tickIntervalRef.current = null;
        }

        // Leave the pool
        leaveMining().catch(() => { });
    }, []);

    // Core function: start mining a single block, auto-continues via ref
    const startMiningBlock = useCallback(async () => {
        const mode = modeRef.current;

        if (!isMiningRef.current) return;

        try {
            const joinRes = await joinMining(mode);
            const { block: joinedBlock } = joinRes.data;

            if (!isMiningRef.current) return; // User stopped while we were joining

            setBlock(prev => ({ ...prev, ...joinedBlock }));
            setStatusText(`Mining Block #${joinedBlock.blockNumber} — searching for hash...`);
            setHashrate(0);
            setNoncesTried(0);
            setElapsed(0);

            // Kill old worker if any
            if (workerRef.current) {
                workerRef.current.terminate();
                workerRef.current = null;
            }

            // Start a new Web Worker
            const worker = new Worker(
                new URL('../workers/miningWorker.js', import.meta.url),
                { type: 'module' }
            );
            workerRef.current = worker;

            worker.onmessage = async (e) => {
                const msg = e.data;

                if (msg.type === 'progress') {
                    setHashrate(msg.hashrate);
                    setNoncesTried(msg.hashCount);
                    setElapsed(msg.elapsed);
                }

                if (msg.type === 'found') {
                    setStatusText('Hash found! Submitting to server...');

                    try {
                        const submitRes = await submitHash(msg.hash, msg.nonce);
                        setMiningResult(submitRes.data);
                        updateUser(submitRes.data.newBalance);
                        setStatusText(`🎉 Block #${submitRes.data.blockNumber} mined! +${submitRes.data.finderReward} XNH — continuing...`);
                        fetchBlockData();

                        // Auto-continue to next block using ref (avoids stale closure)
                        if (isMiningRef.current) {
                            setTimeout(() => {
                                if (isMiningRef.current && startMiningBlockRef.current) {
                                    startMiningBlockRef.current();
                                }
                            }, 1000);
                        }
                    } catch (err) {
                        const errMsg = err.response?.data?.error || 'Submit failed';
                        if (errMsg.includes('already completed') || errMsg.includes('already been solved') || errMsg.includes('No active block')) {
                            setStatusText('Block completed — moving to next...');
                            fetchBlockData();
                            if (isMiningRef.current) {
                                setTimeout(() => {
                                    if (isMiningRef.current && startMiningBlockRef.current) {
                                        startMiningBlockRef.current();
                                    }
                                }, 500);
                            }
                        } else {
                            setMiningResult({ error: errMsg });
                            setStatusText('Submit failed: ' + errMsg);
                            stopMining();
                        }
                    }
                }
            };

            // Start hashing
            worker.postMessage({
                type: 'start',
                data: {
                    blockNumber: joinedBlock.blockNumber,
                    telegramId: user.telegramId,
                    targetDifficulty: joinedBlock.targetDifficulty
                }
            });
        } catch (err) {
            const errMsg = err.response?.data?.error || 'Failed to join mining';
            // If it's a temporary error, retry after delay
            if (isMiningRef.current && (errMsg.includes('energy') || errMsg.includes('locked'))) {
                setMiningResult({ error: errMsg });
                setStatusText('Mining stopped: ' + errMsg);
                stopMining();
            } else if (isMiningRef.current) {
                setStatusText('Retrying join...');
                setTimeout(() => {
                    if (isMiningRef.current && startMiningBlockRef.current) {
                        startMiningBlockRef.current();
                    }
                }, 2000);
            }
        }
    }, [user, fetchBlockData, stopMining, updateUser]);

    // Keep the ref always pointing to the latest version of startMiningBlock
    useEffect(() => {
        startMiningBlockRef.current = startMiningBlock;
    }, [startMiningBlock]);

    const handleStartMining = async () => {
        if (isMining) {
            stopMining();
            return;
        }

        const modeConfig = modes.find(m => m.id === selectedMode);
        if (!user || user.energy < modeConfig.cost) return;

        // Check if mode is unlocked
        if (user.unlockedModes && !user.unlockedModes.includes(selectedMode)) {
            setMiningResult({ error: `${selectedMode} mode is locked. Buy it in the Service tab.` });
            return;
        }

        setIsMining(true);
        isMiningRef.current = true;
        modeRef.current = selectedMode;
        setMiningResult(null);
        setHashrate(0);
        setNoncesTried(0);
        setElapsed(0);
        setStatusText('Joining mining pool...');

        // Start mining the first block
        await startMiningBlock();

        // Energy tick every 2 seconds
        if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = setInterval(async () => {
            if (!isMiningRef.current) return;

            try {
                const tickRes = await miningTick();

                if (!tickRes.data.continue) {
                    // Out of energy or no active block
                    setStatusText(`Mining stopped: ${tickRes.data.reason}`);
                    stopMining();
                    return;
                }

                // Update user energy
                updateUser({
                    energy: tickRes.data.energy,
                    maxEnergy: tickRes.data.maxEnergy
                });
            } catch (err) {
                console.error('Tick error:', err);
            }
        }, 2000);
    };

    const currentMode = modes.find(m => m.id === selectedMode);
    const canMine = user && user.energy >= currentMode.cost
        && (!user.unlockedModes || user.unlockedModes.includes(selectedMode));

    const energyPercent = user ? (user.energy / user.maxEnergy) * 100 : 0;

    return (
        <div className="page mining-page">
            <div className="section-title">
                <span className="title-icon">⛏️</span>
                Mining
            </div>

            {/* Energy & Token Overview */}
            <div className="info-card">
                <div className="info-row">
                    <span className="info-label">Energy</span>
                    <div className="energy-bar-container">
                        <div className="energy-bar">
                            <div
                                className="energy-fill"
                                style={{ width: `${energyPercent}%` }}
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
                            <span className="block-value">{'0'.repeat(block.targetDifficulty || 4)}...</span>
                        </div>
                        <div className="block-item">
                            <span className="block-label">Reward</span>
                            <span className="block-value">{block.reward?.toLocaleString()} XNH</span>
                        </div>
                        <div className="block-item">
                            <span className="block-label">Online</span>
                            <span className="block-value highlight">{block.onlineMiners || 0}</span>
                        </div>
                        <div className="block-item">
                            <span className="block-label">Era</span>
                            <span className="block-value">{block.era || 0}</span>
                        </div>
                        <div className="block-item">
                            <span className="block-label">Shares</span>
                            <span className="block-value">{block.totalShares}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Live Mining Stats */}
            {isMining && (
                <div className="info-card mining-live-card">
                    <div className="mining-live-title">⚡ Mining in Progress</div>
                    <div className="mining-stats-grid">
                        <div className="mining-stat">
                            <span className="mining-stat-value">{hashrate.toLocaleString()}</span>
                            <span className="mining-stat-label">H/s</span>
                        </div>
                        <div className="mining-stat">
                            <span className="mining-stat-value">{noncesTried.toLocaleString()}</span>
                            <span className="mining-stat-label">Hashes</span>
                        </div>
                        <div className="mining-stat">
                            <span className="mining-stat-value">{elapsed}s</span>
                            <span className="mining-stat-label">Time</span>
                        </div>
                    </div>
                    <div className="mining-progress-bar">
                        <div className="mining-progress-fill mining-pulse" />
                    </div>
                </div>
            )}

            {/* Status Text */}
            <div className="mining-status-text">{statusText}</div>

            {/* Mining Mode Selection */}
            <div className="mode-selector">
                {modes.map(mode => {
                    const isLocked = user?.unlockedModes && !user.unlockedModes.includes(mode.id);
                    return (
                        <button
                            key={mode.id}
                            className={`mode-btn ${selectedMode === mode.id ? 'active' : ''} ${isLocked ? 'locked' : ''} ${user?.energy < mode.cost ? 'disabled' : ''}`}
                            onClick={() => !isLocked && setSelectedMode(mode.id)}
                            disabled={isLocked || isMining}
                        >
                            {isLocked && <span className="lock-icon">🔒</span>}
                            {mode.label}
                            <span className="mode-cost">{mode.cost}⚡/tick</span>
                        </button>
                    );
                })}
            </div>

            {/* Start/Stop Mining Button */}
            <button
                className={`mine-btn ${isMining ? 'mining-active stop-btn' : ''} ${!canMine && !isMining ? 'disabled' : ''}`}
                onClick={handleStartMining}
                disabled={!canMine && !isMining}
            >
                {isMining ? (
                    <span className="mining-spinner">
                        <span className="spinner"></span> Stop Mining
                    </span>
                ) : (
                    '⛏️ Start Mining'
                )}
            </button>

            {/* Mining Result */}
            {miningResult && !miningResult.error && (
                <div className="mining-result success">
                    <div className="result-header">
                        <span className="result-icon">🎉</span>
                        Block #{miningResult.blockNumber} Mined!
                    </div>
                    <div className="result-details">
                        <div className="result-row">
                            <span>Your Reward (Finder 50%)</span>
                            <span className="result-amount">+{miningResult.finderReward?.toFixed(2)} XNH</span>
                        </div>
                        {miningResult.poolMinersCount > 0 && (
                            <div className="result-row">
                                <span>Pool Miners ({miningResult.poolMinersCount})</span>
                                <span className="result-amount">{miningResult.poolShareEach?.toFixed(2)} XNH each</span>
                            </div>
                        )}
                        <div className="result-row total">
                            <span>Total Block Reward</span>
                            <span className="result-amount">{miningResult.totalBlockReward?.toFixed(2)} XNH</span>
                        </div>
                    </div>
                    <div className="result-hash">
                        Hash: {miningResult.hash?.substring(0, 24)}...
                    </div>
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
                                <span className="block-reward">+{b.reward} XNH</span>
                                <span className="block-hash">{b.winningHash || ''}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
