const express = require('express');
const router = express.Router();
const Claim = require('../models/Claim');
const Farmer = require('../models/Farmer');
const { v4: uuidv4 } = require('uuid');

// Submit new claim
router.post('/submit', async (req, res) => {
  try {
    const {
      farmerId,
      cropType,
      farmSize,
      claimedLoss,
      claimAmount,
      incidentDate,
      reason,
      description,
      cropLocation,
      affectedArea,
      evidenceUrls,
      submissionChannel = 'web'
    } = req.body;

    // Validate required fields
    if (!farmerId || !cropType || !farmSize || !claimedLoss || !claimAmount || !incidentDate || !reason || !cropLocation) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['farmerId', 'cropType', 'farmSize', 'claimedLoss', 'claimAmount', 'incidentDate', 'reason', 'cropLocation']
      });
    }

    // Get farmer details
    const farmer = await Farmer.findOne({ farmerId });
    if (!farmer) {
      return res.status(404).json({ error: 'Farmer not found' });
    }

    // Generate unique claim ID
    const claimId = `CLM-${Date.now()}-${uuidv4().substr(0, 8).toUpperCase()}`;

    // Create new claim
    const claim = new Claim({
      claimId,
      farmer: {
        farmerId: farmer.farmerId,
        name: farmer.personalInfo.name,
        phoneNumber: farmer.personalInfo.phoneNumber
      },
      claimDetails: {
        cropType,
        farmSize,
        claimedLoss,
        claimAmount,
        incidentDate: new Date(incidentDate),
        reason,
        description,
        evidenceUrls: evidenceUrls || []
      },
      location: {
        cropLocation,
        affectedArea,
        gpsVerified: false
      },
      metadata: {
        submissionChannel,
        deviceInfo: req.headers['user-agent'],
        ipAddress: req.ip
      }
    });

    // Add initial timeline entry
    claim.timeline.push({
      event: 'Claim submitted',
      timestamp: new Date(),
      details: `Claim submitted via ${submissionChannel}`,
      actor: 'farmer'
    });

    await claim.save();

    // Update farmer's claim history
    await farmer.addClaim({
      claimId,
      amount: claimAmount,
      reason,
      cropType
    });

    console.log(`📝 New claim submitted: ${claimId} by farmer ${farmerId}`);

    // Trigger AI assessment asynchronously
    if (req.agents && req.agents.claimAgent) {
      setImmediate(async () => {
        try {
          console.log(`🤖 Starting AI assessment for claim ${claimId}`);
          
          const claimData = {
            claimId,
            farmer: {
              name: farmer.personalInfo.name,
              phoneNumber: farmer.personalInfo.phoneNumber,
              previousClaims: farmer.claimHistory.length,
              successRate: farmer.successRate,
              registrationDate: farmer.registrationDate
            },
            cropType,
            farmSize,
            claimedLoss,
            claimAmount,
            incidentDate,
            reason,
            cropLocation
          };

          const assessment = await req.agents.claimAgent.assessClaim(claimData);
          
          // Update claim with assessment
          const updatedClaim = await Claim.findOne({ claimId });
          if (updatedClaim) {
            await updatedClaim.setAssessment({
              ai: assessment.assessment,
              network: assessment.assessment.networkIntelligence,
              final: {
                approved: assessment.assessment.approved,
                payoutAmount: assessment.assessment.payoutAmount,
                payoutPercentage: (assessment.assessment.payoutAmount / claimAmount) * 100,
                decisionBy: 'ai-agent',
                reasoning: assessment.assessment.reasoning
              }
            });

            console.log(`✅ AI assessment complete for claim ${claimId}: ${assessment.assessment.approved ? 'APPROVED' : 'REJECTED'}`);

            // Emit real-time update
            if (req.io) {
              req.io.to(`farmer-${farmerId}`).emit('claim-assessed', {
                claimId,
                assessment: assessment.assessment,
                timestamp: new Date().toISOString()
              });
            }
          }
        } catch (error) {
          console.error(`❌ AI assessment failed for claim ${claimId}:`, error);
        }
      });
    }

    // Emit real-time update for claim submission
    if (req.io) {
      req.io.to(`farmer-${farmerId}`).emit('claim-submitted', {
        claimId,
        status: 'submitted',
        timestamp: new Date().toISOString()
      });
    }

    res.status(201).json({
      status: 'success',
      message: 'Claim submitted successfully',
      data: {
        claimId,
        status: claim.status.current,
        submittedAt: claim.createdAt
      }
    });
  } catch (error) {
    console.error('Claim submission error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to submit claim',
      error: error.message
    });
  }
});

// Get claim by ID
router.get('/:claimId', async (req, res) => {
  try {
    const { claimId } = req.params;
    
    const claim = await Claim.findOne({ claimId });
    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    res.json({
      status: 'success',
      data: claim
    });
  } catch (error) {
    console.error('Get claim error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve claim',
      error: error.message
    });
  }
});

// Get claims by farmer
router.get('/farmer/:farmerId', async (req, res) => {
  try {
    const { farmerId } = req.params;
    const { page = 1, limit = 10, status } = req.query;
    
    let query = { 'farmer.farmerId': farmerId };
    if (status) {
      query['status.current'] = status;
    }

    const claims = await Claim.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Claim.countDocuments(query);

    res.json({
      status: 'success',
      data: {
        claims,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get farmer claims error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve farmer claims',
      error: error.message
    });
  }
});

// Get all claims (admin/dashboard view)
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      riskLevel, 
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    let query = {};
    if (status) query['status.current'] = status;
    if (riskLevel) query['assessment.aiAssessment.riskLevel'] = riskLevel;

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const claims = await Claim.find(query)
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Claim.countDocuments(query);

    // Get summary statistics
    const stats = await Claim.aggregate([
      {
        $group: {
          _id: '$status.current',
          count: { $sum: 1 },
          totalAmount: { $sum: '$claimDetails.claimAmount' }
        }
      }
    ]);

    res.json({
      status: 'success',
      data: {
        claims,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        },
        stats
      }
    });
  } catch (error) {
    console.error('Get claims error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve claims',
      error: error.message
    });
  }
});

// Update claim status (admin action)
router.patch('/:claimId/status', async (req, res) => {
  try {
    const { claimId } = req.params;
    const { status, reason, updatedBy = 'admin' } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const claim = await Claim.findOne({ claimId });
    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    await claim.updateStatus(status, updatedBy, reason);

    // Emit real-time update
    if (req.io) {
      req.io.to(`farmer-${claim.farmer.farmerId}`).emit('claim-status-updated', {
        claimId,
        status,
        reason,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      status: 'success',
      message: 'Claim status updated successfully',
      data: {
        claimId,
        newStatus: status,
        updatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Update claim status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update claim status',
      error: error.message
    });
  }
});

// Process payment for approved claim
router.post('/:claimId/payment', async (req, res) => {
  try {
    const { claimId } = req.params;
    const { method, accountDetails, amount } = req.body;
    
    if (!method || !accountDetails || !amount) {
      return res.status(400).json({ 
        error: 'Payment method, account details, and amount are required' 
      });
    }

    const claim = await Claim.findOne({ claimId });
    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    if (claim.status.current !== 'approved') {
      return res.status(400).json({ error: 'Claim must be approved before payment' });
    }

    // Generate transaction ID
    const transactionId = `TXN-${Date.now()}-${uuidv4().substr(0, 8).toUpperCase()}`;

    // Process payment (this would integrate with actual payment gateway)
    await claim.processPayment({
      method,
      accountDetails,
      transactionId,
      paidAmount: amount,
      paidDate: new Date()
    });

    // Update claim status to paid
    await claim.updateStatus('paid', 'system', 'Payment processed successfully');

    console.log(`💰 Payment processed for claim ${claimId}: ${amount} via ${method}`);

    // Emit real-time update
    if (req.io) {
      req.io.to(`farmer-${claim.farmer.farmerId}`).emit('payment-processed', {
        claimId,
        transactionId,
        amount,
        method,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      status: 'success',
      message: 'Payment processed successfully',
      data: {
        claimId,
        transactionId,
        amount,
        method,
        processedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Process payment error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to process payment',
      error: error.message
    });
  }
});

// Get claim statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    }

    const stats = await Claim.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalClaims: { $sum: 1 },
          totalAmount: { $sum: '$claimDetails.claimAmount' },
          avgAmount: { $avg: '$claimDetails.claimAmount' },
          approvedClaims: {
            $sum: { $cond: [{ $eq: ['$status.current', 'approved'] }, 1, 0] }
          },
          paidClaims: {
            $sum: { $cond: [{ $eq: ['$status.current', 'paid'] }, 1, 0] }
          },
          rejectedClaims: {
            $sum: { $cond: [{ $eq: ['$status.current', 'rejected'] }, 1, 0] }
          }
        }
      }
    ]);

    const statusBreakdown = await Claim.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$status.current',
          count: { $sum: 1 },
          totalAmount: { $sum: '$claimDetails.claimAmount' }
        }
      }
    ]);

    const cropTypeBreakdown = await Claim.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$claimDetails.cropType',
          count: { $sum: 1 },
          totalAmount: { $sum: '$claimDetails.claimAmount' },
          avgLoss: { $avg: '$claimDetails.claimedLoss' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      status: 'success',
      data: {
        overview: stats[0] || {
          totalClaims: 0,
          totalAmount: 0,
          avgAmount: 0,
          approvedClaims: 0,
          paidClaims: 0,
          rejectedClaims: 0
        },
        statusBreakdown,
        cropTypeBreakdown,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Get claim stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve claim statistics',
      error: error.message
    });
  }
});

module.exports = router;