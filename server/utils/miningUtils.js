const crypto = require('crypto');

const TOTAL_SUPPLY = 1_000_000_000; // 1 Billion XNH
const INITIAL_BLOCK_REWARD = 1000;
const HALVING_INTERVAL = 100; // Halve every 100 blocks
const MIN_REWARD = 0.01;

/**
 * Calculate block reward based on halving schedule
 * Reward = 1000 / (2 ^ floor(blockNumber / 100))
 */
function calculateBlockReward(blockNumber) {
    const era = Math.floor((blockNumber - 1) / HALVING_INTERVAL);
    const reward = INITIAL_BLOCK_REWARD / Math.pow(2, era);
    return Math.max(reward, MIN_REWARD);
}

/**
 * Get the halving era for a block number
 */
function getEra(blockNumber) {
    return Math.floor((blockNumber - 1) / HALVING_INTERVAL);
}

/**
 * Calculate target difficulty (number of leading zeros) based on block number
 * Starts at 4, increases by 1 every 200 blocks
 */
function getTargetDifficulty(blockNumber) {
    const baseDifficulty = 4;
    const increase = Math.floor((blockNumber - 1) / 200);
    return Math.min(baseDifficulty + increase, 10); // Cap at 10
}

/**
 * Compute SHA-256 hash for mining: SHA256(blockNumber + nonce + telegramId)
 */
function computeHash(blockNumber, nonce, telegramId) {
    const input = `${blockNumber}:${nonce}:${telegramId}`;
    return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Validate that a hash meets the difficulty requirement (leading zeros)
 */
function validateHash(hash, difficulty) {
    const prefix = '0'.repeat(difficulty);
    return hash.startsWith(prefix);
}

/**
 * Verify a submitted mined hash
 * Returns { valid, hash } 
 */
function verifyMinedHash(blockNumber, nonce, telegramId, difficulty) {
    const hash = computeHash(blockNumber, nonce, telegramId);
    const valid = validateHash(hash, difficulty);
    return { valid, hash };
}

module.exports = {
    TOTAL_SUPPLY,
    INITIAL_BLOCK_REWARD,
    HALVING_INTERVAL,
    MIN_REWARD,
    calculateBlockReward,
    getEra,
    getTargetDifficulty,
    computeHash,
    validateHash,
    verifyMinedHash
};
