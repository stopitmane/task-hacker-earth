const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema({
  claimId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  farmer: {
    farmerId: { type: String, required: true, index: true },
    name: String,
    phoneNumber: String
  },
  claimDetails: {
    cropType: { type: String, required: true },
    farmSize: { type: Number, required: true },
    claimedLoss: { type: Number, required: true, min: 0, max: 100 }, // percentage
    claimAmount: { type: Number, required: true, min: 0 },
    incidentDate: { type: Date, required: true },
    reason: { 
      type: String, 
      required: true,
      enum: ['drought', 'flood', 'pest_attack', 'disease', 'hail', 'fire', 'other']
    },
    description: String,
    evidenceUrls: [String] // Photos, documents
  },
  location: {
    cropLocation: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      radius: { type: Number, default: 1000 } // meters
    },
    affectedArea: Number, // hectares
    gpsVerified: { type: Boolean, default: false }
  },
  status: {
    current: { 
      type: String, 
      enum: ['submitted', 'under_review', 'approved', 'rejected', 'paid', 'cancelled'],
      default: 'submitted'
    },
    history: [{
      status: String,
      timestamp: Date,
      updatedBy: String,
      reason: String
    }]
  },
  assessment: {
    aiAssessment: {
      approved: Boolean,
      confidence: Number,
      riskScore: Number,
      fraudProbability: Number,
      reasoning: String,
      timestamp: Date,
      agent: String
    },
    humanReview: {
      reviewed: { type: Boolean, default: false },
      reviewer: String,
      decision: String,
      notes: String,
      timestamp: Date
    },
    networkIntelligence: {
      locationVerification: {
        verified: Boolean,
        confidence: Number,
        timestamp: Date
      },
      simSwapCheck: {
        swapped: Boolean,
        riskLevel: String,
        timestamp: Date
      },
      deviceStatus: {
        connectivity: String,
        roaming: Boolean,
        timestamp: Date
      }
    },
    finalDecision: {
      approved: Boolean,
      payoutAmount: Number,
      payoutPercentage: Number,
      decisionDate: Date,
      decisionBy: String,
      reasoning: String
    }
  },
  payment: {
    method: { type: String, enum: ['bank_transfer', 'mobile_money', 'cash'] },
    accountDetails: String,
    transactionId: String,
    paidAmount: Number,
    paidDate: Date,
    status: { 
      type: String, 
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending'
    }
  },
  timeline: [{
    event: String,
    timestamp: Date,
    details: String,
    actor: String // system, agent, human
  }],
  metadata: {
    submissionChannel: { type: String, enum: ['web', 'mobile', 'sms', 'call'] },
    deviceInfo: String,
    ipAddress: String,
    userAgent: String
  },
  flags: [{
    type: { type: String, enum: ['fraud_risk', 'duplicate', 'suspicious_pattern', 'manual_review'] },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
    description: String,
    flaggedBy: String,
    flaggedAt: Date,
    resolved: { type: Boolean, default: false }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for processing time
claimSchema.virtual('processingTime').get(function() {
  if (this.status.current === 'submitted' || this.status.current === 'under_review') {
    return Date.now() - this.createdAt.getTime();
  }
  
  const finalStatus = this.status.history.find(h => 
    ['approved', 'rejected', 'paid'].includes(h.status)
  );
  
  if (finalStatus) {
    return finalStatus.timestamp.getTime() - this.createdAt.getTime();
  }
  
  return null;
});

// Virtual for days since submission
claimSchema.virtual('daysSinceSubmission').get(function() {
  return Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24));
});

// Indexes for performance
claimSchema.index({ 'farmer.farmerId': 1 });
claimSchema.index({ 'status.current': 1 });
claimSchema.index({ createdAt: -1 });
claimSchema.index({ 'claimDetails.incidentDate': -1 });
claimSchema.index({ 'location.cropLocation': '2dsphere' });
claimSchema.index({ 'assessment.finalDecision.approved': 1 });

// Pre-save middleware to update timeline
claimSchema.pre('save', function(next) {
  if (this.isModified('status.current')) {
    this.timeline.push({
      event: `Status changed to ${this.status.current}`,
      timestamp: new Date(),
      details: `Claim status updated`,
      actor: 'system'
    });
    
    this.status.history.push({
      status: this.status.current,
      timestamp: new Date(),
      updatedBy: 'system'
    });
  }
  next();
});

// Methods
claimSchema.methods.updateStatus = function(newStatus, updatedBy = 'system', reason = '') {
  const oldStatus = this.status.current;
  this.status.current = newStatus;
  
  this.status.history.push({
    status: newStatus,
    timestamp: new Date(),
    updatedBy,
    reason
  });
  
  this.timeline.push({
    event: `Status changed from ${oldStatus} to ${newStatus}`,
    timestamp: new Date(),
    details: reason,
    actor: updatedBy
  });
  
  return this.save();
};

claimSchema.methods.addFlag = function(flagData) {
  this.flags.push({
    type: flagData.type,
    severity: flagData.severity,
    description: flagData.description,
    flaggedBy: flagData.flaggedBy || 'system',
    flaggedAt: new Date()
  });
  
  this.timeline.push({
    event: `Flag added: ${flagData.type}`,
    timestamp: new Date(),
    details: flagData.description,
    actor: flagData.flaggedBy || 'system'
  });
  
  return this.save();
};

claimSchema.methods.setAssessment = function(assessmentData) {
  if (assessmentData.ai) {
    this.assessment.aiAssessment = {
      ...assessmentData.ai,
      timestamp: new Date()
    };
  }
  
  if (assessmentData.network) {
    this.assessment.networkIntelligence = assessmentData.network;
  }
  
  if (assessmentData.final) {
    this.assessment.finalDecision = {
      ...assessmentData.final,
      decisionDate: new Date()
    };
    
    // Update status based on decision
    const newStatus = assessmentData.final.approved ? 'approved' : 'rejected';
    this.updateStatus(newStatus, assessmentData.final.decisionBy, assessmentData.final.reasoning);
  }
  
  this.timeline.push({
    event: 'Assessment completed',
    timestamp: new Date(),
    details: 'AI and network intelligence assessment completed',
    actor: 'agent'
  });
  
  return this.save();
};

claimSchema.methods.processPayment = function(paymentData) {
  this.payment = {
    ...this.payment,
    ...paymentData,
    status: 'processing'
  };
  
  this.timeline.push({
    event: 'Payment initiated',
    timestamp: new Date(),
    details: `Payment of ${paymentData.paidAmount} initiated via ${paymentData.method}`,
    actor: 'system'
  });
  
  return this.save();
};

// Static methods
claimSchema.statics.findByFarmer = function(farmerId) {
  return this.find({ 'farmer.farmerId': farmerId }).sort({ createdAt: -1 });
};

claimSchema.statics.findByStatus = function(status) {
  return this.find({ 'status.current': status }).sort({ createdAt: -1 });
};

claimSchema.statics.findPendingClaims = function() {
  return this.find({ 
    'status.current': { $in: ['submitted', 'under_review'] }
  }).sort({ createdAt: 1 });
};

claimSchema.statics.findHighRiskClaims = function() {
  return this.find({
    $or: [
      { 'assessment.aiAssessment.fraudProbability': { $gte: 70 } },
      { 'flags.severity': 'critical' },
      { 'assessment.networkIntelligence.simSwapCheck.swapped': true }
    ]
  }).sort({ createdAt: -1 });
};

claimSchema.statics.getClaimStats = function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$status.current',
        count: { $sum: 1 },
        totalAmount: { $sum: '$claimDetails.claimAmount' },
        avgAmount: { $avg: '$claimDetails.claimAmount' }
      }
    }
  ]);
};

module.exports = mongoose.model('Claim', claimSchema);