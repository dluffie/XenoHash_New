import { useTonConnectUI, useTonAddress } from '@tonconnect/ui-react';
import { useUser } from '../context/UserContext';
import { connectWallet } from '../api';
import { useEffect } from 'react';

export default function TokenPage() {
    const { user } = useUser();
    const [tonConnectUI] = useTonConnectUI();
    const tonAddress = useTonAddress();

    // Save wallet address to server when connected
    useEffect(() => {
        if (tonAddress) {
            connectWallet(tonAddress).catch(console.error);
        }
    }, [tonAddress]);

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

    return (
        <div className="page token-page">
            {/* Wallet Connect Section */}
            <div className="wallet-card">
                <div className="wallet-content">
                    <div className="wallet-text">
                        {tonAddress ? (
                            <>
                                <h3>Wallet Connected ✅</h3>
                                <div className="wallet-address" style={{ marginBottom: '0.75rem', fontSize: '0.8rem' }}>
                                    {tonAddress.substring(0, 8)}...{tonAddress.substring(tonAddress.length - 6)}
                                </div>
                                <button className="connect-btn" onClick={handleConnectWallet}>
                                    Disconnect
                                </button>
                            </>
                        ) : (
                            <>
                                <h3>Connect your wallet to collect tokens after TGE</h3>
                                <button className="connect-btn" onClick={handleConnectWallet}>
                                    <span className="connect-icon">💎</span>
                                    Connect
                                </button>
                            </>
                        )}
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
                        Click 'Start Mining' and your device will begin computing SHA-256 hashes
                        to find the correct hash for the current block. Mining continues automatically
                        until your energy depletes. Energy regenerates at 1 per second.
                    </p>
                </div>
            </div>

            <div className="info-section">
                <h4 className="info-section-title">Reward system</h4>
                <div className="info-section-content">
                    <p>
                        50% of the block reward goes to the miner who discovers the correct hash,
                        and 50% is split among other active miners in the pool. Block rewards halve
                        every 100 blocks to control supply.
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
                            <span className="token-stat-value">1,000,000,000 XNH</span>
                        </div>
                        <div className="token-stat-item">
                            <span className="token-stat-label">Halving</span>
                            <span className="token-stat-value">Every 100 blocks</span>
                        </div>
                        <div className="token-stat-item">
                            <span className="token-stat-label">Energy Regen</span>
                            <span className="token-stat-value">1 / second</span>
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
