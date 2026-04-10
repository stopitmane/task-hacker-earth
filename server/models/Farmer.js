const mongoose = require('mongoose');

const farmerSchema = new mongoose.Schema({
  farmerId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  personalInfo: {
    name: { type: String, required: true },
    phoneNumber: { type: String, required: true, unique: true },
    nationalId: { type: String, sparse: true },
    dateOfBirth: Date,
    gender: { type: String, enum: ['male', 'female', 'other'] }
  },
  farmDetails: {
    farmSize: { type: Number, required: true }, // in hectares
    cropTypes: [{ type: String, required: true }],
    farmingExperience: Number, // years
    irrigationType: { type: String, enum: ['rain-fed', 'irrigated', 'mixed'] },
    soilType: String
  },
  location: {
    registeredLocation: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      address: String,
      region: String,
      district: String
    },
    farmBoundaries: [{
      latitude: Number,
      longitude: Number
    }]
  },
  verification: {
    phoneVerified: { type: Boolean, default: false },
    locationVerified: { type: Boolean, default: false },
    identityVerified: { type: Boolean, default: false },
    verificationDate: Date,
    verificationScore: { type: Number, min: 0, max: 100 }
  },
  insurance: {
    policyNumber: String,
    coverageAmount: Number,
    premium: Number,
    policyStartDate: Date,
    policyEndDate: Date,
    isActive: { type: Boolean, default: false }
  },
  claimHistory: [{
    claimId: String,
    date: Date,
    amount: Number,
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'paid'] },
    reason: String,
    cropType: String,
    assessmentScore: Number
  }],
  riskProfile: {
    riskLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'LOW' },
    riskScore: { type: Number, min: 0, max: 100, default: 0 },
    lastRiskAssessment: Date,
    fraudIndicators: [{
      type: String,
      severity: String,
      date: Date,
      details: String
    }]
  },
  networkIntelligence: {
    lastLocationCheck: {
      verified: Boolean,
      confidence: Number,
      timestamp: Date
    },
    lastSimSwapCheck: {
      swapped: Boolean,
      riskLevel: String,
      timestamp: Date
    },
    deviceStatus: {
      connectivity: String,
      roaming: Boolean,
      lastUpdate: Date
    }
  },
  financialInfo: {
    bankAccount: String,
    mobileMoneyNumber: String,
    preferredPaymentMethod: { type: String, enum: ['bank', 'mobile_money', 'cash'] },
    creditScore: Number
  },
  registrationDate: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now },
  status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for success rate
farmerSchema.virtual('successRate').get(function() {
  if (!this.claimHistory || this.claimHistory.length === 0) return 100;
  
  const approvedClaims = this.claimHistory.filter(claim => 
    claim.status === 'approved' || claim.status === 'paid'
  ).length;
  
  return Math.round((approvedClaims / this.claimHistory.length) * 100);
});

// Virtual for total claims amount
farmerSchema.virtual('totalClaimsAmount').get(function() {
  if (!this.claimHistory || this.claimHistory.length === 0) return 0;
  
  return this.claimHistory
    .filter(claim => claim.status === 'approved' || claim.status === 'paid')
    .reduce((total, claim) => total + claim.amount, 0);
});

// Indexes for performance
farmerSchema.index({ 'personalInfo.phoneNumber': 1 });
farmerSchema.index({ 'location.registeredLocation': '2dsphere' });
farmerSchema.index({ 'riskProfile.riskLevel': 1 });
farmerSchema.index({ registrationDate: -1 });
farmerSchema.index({ status: 1 });

// Pre-save middleware
farmerSchema.pre('save', function(next) {
  this.lastActive = new Date();
  next();
});

// Methods
farmerSchema.methods.updateRiskProfile = function(riskData) {
  this.riskProfile.riskLevel = riskData.riskLevel;
  this.riskProfile.riskScore = riskData.riskScore;
  this.riskProfile.lastRiskAssessment = new Date();
  
  if (riskData.fraudIndicators) {
    this.riskProfile.fraudIndicators.push(...riskData.fraudIndicators);
  }
  
  return this.save();
};

farmerSchema.methods.addClaim = function(claimData) {
  this.claimHistory.push({
    claimId: claimData.claimId,
    date: new Date(),
    amount: claimData.amount,
    status: 'pending',
    reason: claimData.reason,
    cropType: claimData.cropType
  });
  
  return this.save();
};

farmerSchema.methods.updateNetworkIntelligence = function(networkData) {
  if (networkData.locationCheck) {
    this.networkIntelligence.lastLocationCheck = {
      verified: networkData.locationCheck.verified,
      confidence: networkData.locationCheck.confidence,
      timestamp: new Date()
    };
  }
  
  if (networkData.simSwapCheck) {
    this.networkIntelligence.lastSimSwapCheck = {
      swapped: networkData.simSwapCheck.swapped,
      riskLevel: networkData.simSwapCheck.riskLevel,
      timestamp: new Date()
    };
  }
  
  if (networkData.deviceStatus) {
    this.networkIntelligence.deviceStatus = {
      connectivity: networkData.deviceStatus.connectivity,
      roaming: networkData.deviceStatus.roaming,
      lastUpdate: new Date()
    };
  }
  
  return this.save();
};

// Static methods
farmerSchema.statics.findByPhoneNumber = function(phoneNumber) {
  return this.findOne({ 'personalInfo.phoneNumber': phoneNumber });
};

farmerSchema.statics.findByRiskLevel = function(riskLevel) {
  return this.find({ 'riskProfile.riskLevel': riskLevel });
};

farmerSchema.statics.findNearLocation = function(latitude, longitude, maxDistance = 10000) {
  return this.find({
    'location.registeredLocation': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: maxDistance
      }
    }
  });
};

module.exports = mongoose.model('Farmer', farmerSchema);