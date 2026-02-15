import { useState, useEffect, useRef } from 'react';
import { useUser } from '../context/UserContext';
import { getCurrentBlock, joinMining, miningTick, submitHash, leaveMining, getLastBlocks } from '../api';

export default function MiningPage() {
    const { user, updateUser } = useUser();
    const [block, setBlock] = useState(null);
    const [lastBlocks, setLastBlocks] = useState([]);
    const [selectedMode, setSelectedMode] = useState('basic');
    const [expandedBlock, setExpandedBlock] = useState(null);

    // Mining state
    const [isMining, setIsMining] = useState(false);
    const [hashrate, setHashrate] = useState(0);
    const [sessionHashes, setSessionHashes] = useState(0);
    const [sessionDuration, setSessionDuration] = useState(0);
    const [miningResult, setMiningResult] = useState(null);
    const [statusText, setStatusText] = useState('Ready to mine');

    // Refs
    const workerRef = useRef(null);
    const tickIntervalRef = useRef(null);
    const isMiningRef = useRef(false);
    const sessionStartRef = useRef(0);
    const cumulativeHashesRef = useRef(0);
    const sessionStartBalanceRef = useRef(null);

    const modes = [
        { id: 'basic', label: 'Basic', cost: 100, multiplier: '1x' },
        { id: 'turbo', label: 'Turbo', cost: 200, multiplier: '2x' },
        { id: 'super', label: 'Super', cost: 400, multiplier: '4x' },
        { id: 'nitro', label: 'Nitro', cost: 800, multiplier: '8x' }
    ];

    const MODE_THROTTLE = {
        basic: 50, // Throttle Basic mode (low CPU)
        turbo: 0,
        super: 0,
        nitro: 0
    };

    // Fetch block data
    const fetchBlockData = async () => {
        try {
            const blockRes = await getCurrentBlock();
            setBlock(blockRes.data);
        } catch (err) {
            console.error('Failed to fetch current block:', err);
        }

        try {
            const blocksRes = await getLastBlocks();
            setLastBlocks(blocksRes.data.blocks || []);
        } catch (err) {
            console.error('Failed to fetch last blocks:', err);
        }
    };

    useEffect(() => {
        fetchBlockData();
        const interval = setInterval(fetchBlockData, 15000);
        return () => clearInterval(interval);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            isMiningRef.current = false;
            if (workerRef.current) {
                workerRef.current.terminate();
            }
            if (tickIntervalRef.current) {
                clearInterval(tickIntervalRef.current);
            }
            leaveMining().catch(() => { });
        };
    }, []);

    // Kill the current worker
    const killWorker = () => {
        if (workerRef.current) {
            workerRef.current.postMessage({ type: 'stop' });
            workerRef.current.terminate();
            workerRef.current = null;
        }
    };

    // Stop everything
    const stopMining = () => {
        isMiningRef.current = false;
        setIsMining(false);
        setStatusText('Mining stopped');
        killWorker();
        if (tickIntervalRef.current) {
            clearInterval(tickIntervalRef.current);
            tickIntervalRef.current = null;
        }
        leaveMining().catch(() => { });

        // Reset session refs so next start begins fresh
        sessionStartRef.current = 0;
        cumulativeHashesRef.current = 0;
        sessionStartBalanceRef.current = null;
    };

    // Mine a single block — returns a promise that resolves when hash is found
    const mineOneBlock = (blockNumber, telegramId, targetDifficulty, mode, onProgress) => {
        return new Promise((resolve, reject) => {
            killWorker();

            const worker = new Worker(
                new URL('../workers/miningWorker.js', import.meta.url),
                { type: 'module' }
            );
            workerRef.current = worker;

            worker.onmessage = (e) => {
                const msg = e.data;
                if (msg.type === 'progress') {
                    onProgress(msg.hashrate, msg.hashCount);
                }
                if (msg.type === 'found') {
                    resolve({ hash: msg.hash, nonce: msg.nonce, hashes: msg.hashCount });
                }
            };

            worker.onerror = (err) => {
                reject(err);
            };

            worker.postMessage({
                type: 'start',
                data: {
                    blockNumber,
                    telegramId,
                    targetDifficulty,
                    throttle: MODE_THROTTLE[mode] || 0
                }
            });
        });
    };

    // Main mining loop — keeps mining blocks until energy runs out
    const startMiningLoop = async (mode) => {
        isMiningRef.current = true;
        setIsMining(true);
        setMiningResult(null);

        // Reset session stats
        if (!sessionStartRef.current) {
            sessionStartRef.current = Date.now();
            cumulativeHashesRef.current = 0;
            // Set start balance if not set
            if (sessionStartBalanceRef.current === null && user) {
                sessionStartBalanceRef.current = user.tokens;
            }
            setSessionHashes(0);
            setSessionDuration(0);
        }

        // Start energy tick interval
        if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = setInterval(async () => {
            if (!isMiningRef.current) return;
            try {
                const tickRes = await miningTick();
                if (!tickRes.data.continue) {
                    setStatusText(`Mining stopped: ${tickRes.data.reason}`);
                    stopMining();
                    return;
                }
                updateUser({
                    energy: tickRes.data.energy,
                    maxEnergy: tickRes.data.maxEnergy,
                    tokens: tickRes.data.tokens
                });

                // Update duration
                setSessionDuration(Math.floor((Date.now() - sessionStartRef.current) / 1000));
            } catch (err) {
                console.error('Tick error:', err);
            }
        }, 2000);

        // Continuous mining loop
        while (isMiningRef.current) {
            try {
                // 1. Join the pool
                // Don't reset hashrate/elapsed here to keep it continuous
                setStatusText('Joining mining pool...');
                const joinRes = await joinMining(mode);
                const joinedBlock = joinRes.data.block;

                if (!isMiningRef.current) break;

                setBlock(prev => ({ ...prev, ...joinedBlock }));
                setStatusText(`Mining Block #${joinedBlock.blockNumber} — searching for hash...`);

                // 2. Mine until hash is found
                const { hash, nonce, hashes } = await mineOneBlock(
                    joinedBlock.blockNumber,
                    user.telegramId,
                    joinedBlock.targetDifficulty,
                    mode,
                    (currentHashrate, blockHashes) => {
                        setHashrate(currentHashrate);
                        setSessionHashes(cumulativeHashesRef.current + blockHashes);
                        setSessionDuration(Math.floor((Date.now() - sessionStartRef.current) / 1000));
                    }
                );

                if (!isMiningRef.current) break;

                // Add block hashes to cumulative total
                cumulativeHashesRef.current += hashes;

                // 3. Submit the hash ... (keep existing logic)
                setStatusText('Hash found! Submitting...');
                try {
                    const submitRes = await submitHash(hash, nonce);
                    setMiningResult(submitRes.data);
                    updateUser(submitRes.data.newBalance);
                    setStatusText(`🎉 Block #${submitRes.data.blockNumber} mined! +${submitRes.data.finderReward} XNH`);
                    fetchBlockData();
                } catch (submitErr) {
                    const errMsg = submitErr.response?.data?.error || 'Submit failed';
                    // If block was already solved by someone else, just continue
                    if (errMsg.includes('already') || errMsg.includes('No active block')) {
                        setStatusText('Block solved by another miner — moving on...');
                        fetchBlockData();
                    } else {
                        setStatusText('Submit error: ' + errMsg);
                    }
                }

                // 4. Small pause before next block
                await new Promise(r => setTimeout(r, 800));

            } catch (err) {
                if (!isMiningRef.current) break;
                const errMsg = err.response?.data?.error || err.message || 'Error';
                if (errMsg.includes('energy') || errMsg.includes('locked')) {
                    setStatusText('Mining stopped: ' + errMsg);
                    break;
                }
                // Temporary error — retry
                setStatusText('Retrying in 2s...');
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        // Loop exited — cleanup
        stopMining();
    };

    const handleStartMining = () => {
        if (isMining) {
            stopMining();
            return;
        }

        const modeConfig = modes.find(m => m.id === selectedMode);
        if (!user || user.energy < modeConfig.cost) return;

        if (user.unlockedModes && !user.unlockedModes.includes(selectedMode)) {
            setMiningResult({ error: `${selectedMode} mode is locked. Buy it in the Service tab.` });
            return;
        }

        startMiningLoop(selectedMode);
    };

    const toggleBlockDetail = (blockNumber) => {
        setExpandedBlock(expandedBlock === blockNumber ? null : blockNumber);
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
                            <span className="block-label">Profit</span>
                            <span className="block-value highlight">
                                +{Math.max(0, ((user?.tokens || 0) - (sessionStartBalanceRef.current ?? (user?.tokens || 0)))).toFixed(2)} XNH
                            </span>
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
                            <span className="mining-stat-value">{sessionHashes.toLocaleString()}</span>
                            <span className="mining-stat-label">Session Hashes</span>
                        </div>
                        <div className="mining-stat">
                            <span className="mining-stat-value">{sessionDuration}s</span>
                            <span className="mining-stat-label">Session Time</span>
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
                            <span className="mode-cost">{mode.cost}⚡</span>
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
                        <div key={i} className={`block-row-wrapper ${expandedBlock === b.blockNumber ? 'expanded' : ''}`}>
                            <div className="block-row" onClick={() => toggleBlockDetail(b.blockNumber)}>
                                <div className="block-row-left">
                                    <span className="block-number">#{b.blockNumber?.toLocaleString()}</span>
                                    <span className="block-miner">{b.minedBy}</span>
                                </div>
                                <div className="block-row-right">
                                    <span className="block-reward">+{b.reward} XNH</span>
                                    <span className="block-expand-icon">{expandedBlock === b.blockNumber ? '▲' : '▼'}</span>
                                </div>
                            </div>
                            {expandedBlock === b.blockNumber && (
                                <div className="block-detail">
                                    <div className="block-detail-row">
                                        <span className="block-detail-label">Hash</span>
                                        <span className="block-detail-value hash-text">{b.winningHash || '—'}</span>
                                    </div>
                                    <div className="block-detail-row">
                                        <span className="block-detail-label">Previous Hash</span>
                                        <span className="block-detail-value hash-text">{b.previousHash || '—'}</span>
                                    </div>
                                    <div className="block-detail-row">
                                        <span className="block-detail-label">Nonce</span>
                                        <span className="block-detail-value">{b.winningNonce?.toLocaleString() || '—'}</span>
                                    </div>
                                    <div className="block-detail-row">
                                        <span className="block-detail-label">Difficulty</span>
                                        <span className="block-detail-value">{'0'.repeat(b.targetDifficulty || 0)}...</span>
                                    </div>
                                    <div className="block-detail-row">
                                        <span className="block-detail-label">Found by</span>
                                        <span className="block-detail-value">{b.minedBy}</span>
                                    </div>
                                    <div className="block-detail-row">
                                        <span className="block-detail-label">Timestamp</span>
                                        <span className="block-detail-value">{b.completedAt ? new Date(b.completedAt).toLocaleString() : '—'}</span>
                                    </div>
                                    <div className="block-detail-row">
                                        <span className="block-detail-label">Era</span>
                                        <span className="block-detail-value">{b.era}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
