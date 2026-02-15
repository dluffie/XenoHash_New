import { useUser } from '../context/UserContext';

export default function TokenPage() {
    const { user } = useUser();

    return (
        <div className="page token-page">
            {/* Wallet Connect Section */}
            <div className="wallet-card">
                <div className="wallet-content">
                    <div className="wallet-text">
                        <h3>Connect your wallet to collect tokens after TGE</h3>
                        <button className="connect-btn">
                            <span className="connect-icon">💎</span>
                            Connect
                        </button>
                    </div>
                    <div className="wallet-icons">
                        <div className="floating-icon icon-1">💎</div>
                        <div className="floating-icon icon-2">💎</div>
                        <div className="floating-icon icon-3">💎</div>
                        <div className="floating-icon icon-4">💎</div>
                    </div>
                </div>
            </div>

            {/* How the system works */}
            <div className="section-title">
                <span className="title-icon">📖</span>
                How the system works
            </div>

            <div className="info-section">
                <h4 className="info-section-title">Earn through mining</h4>
                <div className="info-section-content">
                    <p>
                        Just click on 'Start Mining' and wait for you to receive the tokens.
                        If you are a beginner, we recommend that you focus on mining and only
                        then study the technical part.
                    </p>
                </div>
            </div>

            <div className="info-section">
                <h4 className="info-section-title">Your task</h4>
                <div className="info-section-content">
                    <p>
                        The task of the device is to select the correct hash for the current
                        block. If successful, you will receive a reward for this. 30% of the
                        block reward is intended for the first miner who discovers the correct
                        hash, and 70% is divided among other participants who also participated
                        in the selection.
                    </p>
                    <p style={{ marginTop: '0.75rem' }}>
                        <strong>Attention:</strong> Every 100,000 blocks, the miner's reward will
                        decrease by 5% until it reaches 5%.
                    </p>
                </div>
            </div>

            <div className="info-section">
                <h4 className="info-section-title">Referral program</h4>
                <div className="info-section-content">
                    <p>
                        Invite your friends and earn 10% commission from their mining activities.
                        Share your unique referral code to start earning passive income!
                    </p>
                    {user && (
                        <div className="referral-box">
                            <span className="referral-label">Your referral code:</span>
                            <div className="referral-code-display">
                                <code>{user.referralCode}</code>
                                <button
                                    className="copy-btn"
                                    onClick={() => {
                                        navigator.clipboard?.writeText(user.referralCode);
                                    }}
                                >
                                    📋 Copy
                                </button>
                            </div>
                            <div className="referral-stats-mini">
                                <span>👥 {user.referralCount || 0} friends</span>
                                <span>💰 {(user.referralEarnings || 0).toLocaleString()} XNH earned</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="info-section">
                <h4 className="info-section-title">Token economics</h4>
                <div className="info-section-content">
                    <div className="token-stats-grid">
                        <div className="token-stat-item">
                            <span className="token-stat-label">Total Supply</span>
                            <span className="token-stat-value">2,000,000,000 XNH</span>
                        </div>
                        <div className="token-stat-item">
                            <span className="token-stat-label">Mining Blocks</span>
                            <span className="token-stat-value">2,000,000</span>
                        </div>
                        <div className="token-stat-item">
                            <span className="token-stat-label">Energy Regen</span>
                            <span className="token-stat-value">1 / minute</span>
                        </div>
                        <div className="token-stat-item">
                            <span className="token-stat-label">Referral Bonus</span>
                            <span className="token-stat-value">10% commission</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
