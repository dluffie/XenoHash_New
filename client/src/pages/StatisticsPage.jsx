import { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { getStats, getLeaderboard } from '../api';

export default function StatisticsPage() {
    const { user } = useUser();
    const [stats, setStats] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const [myRank, setMyRank] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [statsRes, leadRes] = await Promise.all([
                    getStats(),
                    getLeaderboard()
                ]);
                setStats(statsRes.data);
                setLeaderboard(leadRes.data.leaderboard || []);
                setMyRank(leadRes.data.myRank);
            } catch (err) {
                console.error('Failed to fetch stats:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="page statistics-page">
                <div className="loading-container">
                    <div className="spinner large"></div>
                    <p>Loading statistics...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page statistics-page">
            {/* Blockchain Statistics */}
            <div className="section-title">
                <span className="title-icon">📊</span>
                Blockchain Statistics
            </div>

            <div className="info-card stats-card">
                <div className="stat-row">
                    <span className="stat-label">Total mined</span>
                    <div className="stat-bar-container">
                        <div className="stat-bar">
                            <div
                                className="stat-fill"
                                style={{ width: `${stats?.totalMined || 0}%` }}
                            />
                        </div>
                    </div>
                    <span className="stat-value">{stats?.totalMined || 0}%</span>
                </div>
                <div className="stat-row">
                    <span className="stat-label">Total issue</span>
                    <span className="stat-value">{stats?.totalIssue?.toLocaleString() || '2,000,000,000'}</span>
                </div>
                <div className="stat-row">
                    <span className="stat-label">Blocks created</span>
                    <span className="stat-value">{stats?.blocksCreated || '0 / 2,000,000'}</span>
                </div>
                <div className="stat-row">
                    <span className="stat-label">Total holders</span>
                    <span className="stat-value">{stats?.totalHolders?.toLocaleString() || 0}</span>
                </div>
                <div className="stat-row">
                    <span className="stat-label">Start date</span>
                    <span className="stat-value">{stats?.startDate || '15 February'}</span>
                </div>
            </div>

            {/* Leaderboard */}
            <div className="section-title" style={{ marginTop: '1.5rem' }}>
                <span className="title-icon">🏆</span>
                Leaderboard
                <span className="reset-hint">Place</span>
            </div>

            {/* My Rank Card */}
            {user && (
                <div className="info-card my-rank-card">
                    <div className="rank-row my-rank">
                        <div className="rank-left">
                            <div className="rank-avatar me">
                                {user.firstName?.charAt(0) || user.username?.charAt(0) || '?'}
                            </div>
                            <div className="rank-info">
                                <span className="rank-name">{user.username || user.firstName || 'You'}</span>
                                <span className="rank-tokens">{user.tokens?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                        <span className="rank-position">{myRank?.toLocaleString()}</span>
                    </div>
                </div>
            )}

            {/* Top Users */}
            <div className="leaderboard-list">
                {leaderboard.slice(0, 20).map((entry) => (
                    <div key={entry.rank} className={`rank-row ${entry.rank <= 3 ? 'top-rank' : ''}`}>
                        <div className="rank-left">
                            <div className={`rank-avatar rank-${entry.rank}`}>
                                {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : entry.username?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div className="rank-info">
                                <span className="rank-name">{entry.username}</span>
                                <span className="rank-tokens">{entry.tokens?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                        <span className={`rank-position ${entry.rank <= 3 ? 'gold' : ''}`}>{entry.rank}</span>
                    </div>
                ))}
                {leaderboard.length === 0 && (
                    <div className="empty-state">No miners yet. Start mining to be #1!</div>
                )}
            </div>
        </div>
    );
}
