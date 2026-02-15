const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  username: {
    type: String,
    default: ''
  },
  firstName: {
    type: String,
    default: ''
  },
  lastName: {
    type: String,
    default: ''
  },
  photoUrl: {
    type: String,
    default: ''
  },
  energy: {
    type: Number,
    default: 2000
  },
  maxEnergy: {
    type: Number,
    default: 2000
  },
  tokens: {
    type: Number,
    default: 0
  },
  totalMined: {
    type: Number,
    default: 0
  },
  miningSessionsCount: {
    type: Number,
    default: 0
  },
  // Unlocked mining modes (purchased via TON)
  unlockedModes: {
    type: [String],
    default: ['basic']
  },
  // TON wallet
  tonWalletAddress: {
    type: String,
    default: null
  },
  referralCode: {
    type: String,
    unique: true
  },
  referredBy: {
    type: String,
    default: null
  },
  referralCount: {
    type: Number,
    default: 0
  },
  referralEarnings: {
    type: Number,
    default: 0
  },
  lastEnergyUpdate: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Generate unique referral code before saving
userSchema.pre('save', function (next) {
  if (!this.referralCode) {
    this.referralCode = 'XH' + this.telegramId.slice(-4) + Math.random().toString(36).substring(2, 6).toUpperCase();
  }
  next();
});

// Method to calculate and apply energy regeneration (1 per second)
userSchema.methods.regenerateEnergy = function () {
  const now = new Date();
  const secondsPassed = Math.floor((now - this.lastEnergyUpdate) / 1000);

  if (secondsPassed > 0) {
    const newEnergy = Math.min(this.energy + secondsPassed, this.maxEnergy);
    this.energy = newEnergy;
    this.lastEnergyUpdate = now;
  }

  return this;
};

module.exports = mongoose.model('User', userSchema);
