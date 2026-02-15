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
userSchema.pre('save', function(next) {
  if (!this.referralCode) {
    this.referralCode = 'XH' + this.telegramId.slice(-4) + Math.random().toString(36).substring(2, 6).toUpperCase();
  }
  next();
});

// Method to calculate and apply energy regeneration (1 per minute)
userSchema.methods.regenerateEnergy = function() {
  const now = new Date();
  const minutesPassed = Math.floor((now - this.lastEnergyUpdate) / 60000);
  
  if (minutesPassed > 0) {
    const newEnergy = Math.min(this.energy + minutesPassed, this.maxEnergy);
    this.energy = newEnergy;
    this.lastEnergyUpdate = now;
  }
  
  return this;
};

module.exports = mongoose.model('User', userSchema);
