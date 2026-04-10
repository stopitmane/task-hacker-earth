const express = require('express');
const router = express.Router();
const Farmer = require('../models/Farmer');
const { v4: uuidv4 } = require('uuid');

// Register new farmer
router.post('/register', async (req, res) => {
  try {
    const {
      name,
      phoneNumber,
      nationalId,
      dateOfBirth,
      gender,
      farmSize,
      cropTypes,
      farmingExperience,
      irrigationType,
      soilType,
      registeredLocation,
      farmBoundaries,
      bankAccount,
      mobileMoneyNumber,
      preferredPaymentMethod
    } = req.body;

    // Validate required fields
    if (!name || !phoneNumber || !farmSize || !cropTypes || !registeredLocation) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['name', 'phoneNumber', 'farmSize', 'cropTypes', 'registeredLocation']
      });
    }

    // Check if farmer already exists
    const existingFarmer = await Farmer.findByPhoneNumber(phoneNumber);
    if (existingFarmer) {
      return res.status(409).json({ error: 'Farmer with this phone number already exists' });
    }

    // Generate unique farmer ID
    const farmerId = `FMR-${Date.now()}-${uuidv4().substr(0, 8).toUpperCase()}`;

    // Create new farmer
    const farmer = new Farmer({
      farmerId,
      personalInfo: {
        name,
        phoneNumber,
        nationalId,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        gender
      },
      farmDetails: {
        farmSize,
        cropTypes,
        farmingExperience,
        irrigationType,
        soilType
      },
      location: {
        registeredLocation,
        farmBoundaries: farmBoundaries || []
      },
      financialInfo: {
        bankAccount,
        mobileMoneyNumber,
        preferredPaymentMethod
      }
    });

    await farmer.save();

    console.log(`👨‍🌾 New farmer registered: ${farmerId} - ${name}`);

    // Trigger fraud detection analysis asynchronously
    if (req.agents && req.agents.fraudAgent) {
      setImmediate(async () => {
        try {
          const fraudAnalysis = await req.agents.fraudAgent.analyzeFraudRisk({
            farmerId,
            name,
            phoneNumber,
            registeredLocation,
            registrationDate: farmer.registrationDate,
            claimHistory: []
          });

          // Update farmer risk profile
          await farmer.updateRiskProfile({
            riskLevel: fraudAnalysis.riskLevel,
            riskScore: fraudAnalysis.riskScore,
            fraudIndicators: fraudAnalysis.analysis?.behavior?.suspiciousIndicators || []
          });

          console.log(`🕵️ Fraud analysis complete for farmer ${farmerId}: ${fraudAnalysis.riskLevel} risk`);
        } catch (error) {
          console.error(`❌ Fraud analysis failed for farmer ${farmerId}:`, error);
        }
      });
    }

    res.status(201).json({
      status: 'success',
      message: 'Farmer registered successfully',
      data: {
        farmerId,
        name,
        phoneNumber,
        registeredAt: farmer.registrationDate
      }
    });
  } catch (error) {
    console.error('Farmer registration error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to register farmer',
      error: error.message
    });
  }
});

// Get farmer by ID
router.get('/:farmerId', async (req, res) => {
  try {
    const { farmerId } = req.params;
    
    const farmer = await Farmer.findOne({ farmerId });
    if (!farmer) {
      return res.status(404).json({ error: 'Farmer not found' });
    }

    res.json({
      status: 'success',
      data: farmer
    });
  } catch (error) {
    console.error('Get farmer error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve farmer',
      error: error.message
    });
  }
});

// Get farmer by phone number
router.get('/phone/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    
    const farmer = await Farmer.findByPhoneNumber(phoneNumber);
    if (!farmer) {
      return res.status(404).json({ error: 'Farmer not found' });
    }

    res.json({
      status: 'success',
      data: farmer
    });
  } catch (error) {
    console.error('Get farmer by phone error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve farmer',
      error: error.message
    });
  }
});

// Update farmer information
router.patch('/:farmerId', async (req, res) => {
  try {
    const { farmerId } = req.params;
    const updates = req.body;
    
    const farmer = await Farmer.findOne({ farmerId });
    if (!farmer) {
      return res.status(404).json({ error: 'Farmer not found' });
    }

    // Update allowed fields
    const allowedUpdates = [
      'personalInfo', 'farmDetails', 'location', 'financialInfo'
    ];
    
    allowedUpdates.forEach(field => {
      if (updates[field]) {
        Object.assign(farmer[field], updates[field]);
      }
    });

    await farmer.save();

    res.json({
      status: 'success',
      message: 'Farmer information updated successfully',
      data: farmer
    });
  } catch (error) {
    console.error('Update farmer error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update farmer',
      error: error.message
    });
  }
});

// Get all farmers (admin/dashboard view)
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      riskLevel, 
      status,
      cropType,
      region,
      sortBy = 'registrationDate',
      sortOrder = 'desc'
    } = req.query;
    
    let query = {};
    if (riskLevel) query['riskProfile.riskLevel'] = riskLevel;
    if (status) query.status = status;
    if (cropType) query['farmDetails.cropTypes'] = cropType;
    if (region) query['location.registeredLocation.region'] = region;

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const farmers = await Farmer.find(query)
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Farmer.countDocuments(query);

    res.json({
      status: 'success',
      data: {
        farmers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get farmers error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve farmers',
      error: error.message
    });
  }
});

// Verify farmer using CAMARA APIs
router.post('/:farmerId/verify', async (req, res) => {
  try {
    const { farmerId } = req.params;
    const { verificationType = 'comprehensive' } = req.body;
    
    const farmer = await Farmer.findOne({ farmerId });
    if (!farmer) {
      return res.status(404).json({ error: 'Farmer not found' });
    }

    let verificationResult;

    if (verificationType === 'comprehensive') {
      // Use CAMARA comprehensive verification
      const CamaraService = require('../services/CamaraService');
      
      verificationResult = await CamaraService.comprehensiveVerification(
        farmer.personalInfo.phoneNumber,
        farmer.location.registeredLocation,
        farmerId
      );

      // Update farmer record
      await farmer.updateNetworkIntelligence({
        locationCheck: verificationResult.checks.location,
        simSwapCheck: verificationResult.checks.simSwap,
        deviceStatus: verificationResult.checks.deviceStatus
      });

      farmer.verification.locationVerified = verificationResult.checks.location?.verified || false;
      farmer.verification.verificationScore = verificationResult.confidenceScore;
      farmer.verification.verificationDate = new Date();
      
      await farmer.save();
    }

    // Emit real-time update
    if (req.io) {
      req.io.to(`farmer-${farmerId}`).emit('verification-complete', {
        farmerId,
        result: verificationResult,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      status: 'success',
      message: 'Farmer verification completed',
      data: verificationResult
    });
  } catch (error) {
    console.error('Farmer verification error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to verify farmer',
      error: error.message
    });
  }
});

// Get farmer statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const stats = await Farmer.aggregate([
      {
        $group: {
          _id: null,
          totalFarmers: { $sum: 1 },
          totalFarmSize: { $sum: '$farmDetails.farmSize' },
          avgFarmSize: { $avg: '$farmDetails.farmSize' },
          verifiedFarmers: {
            $sum: { $cond: ['$verification.phoneVerified', 1, 0] }
          },
          activeFarmers: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          }
        }
      }
    ]);

    const riskBreakdown = await Farmer.aggregate([
      {
        $group: {
          _id: '$riskProfile.riskLevel',
          count: { $sum: 1 }
        }
      }
    ]);

    const cropBreakdown = await Farmer.aggregate([
      { $unwind: '$farmDetails.cropTypes' },
      {
        $group: {
          _id: '$farmDetails.cropTypes',
          count: { $sum: 1 },
          totalFarmSize: { $sum: '$farmDetails.farmSize' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const regionBreakdown = await Farmer.aggregate([
      {
        $group: {
          _id: '$location.registeredLocation.region',
          count: { $sum: 1 },
          totalFarmSize: { $sum: '$farmDetails.farmSize' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      status: 'success',
      data: {
        overview: stats[0] || {
          totalFarmers: 0,
          totalFarmSize: 0,
          avgFarmSize: 0,
          verifiedFarmers: 0,
          activeFarmers: 0
        },
        riskBreakdown,
        cropBreakdown,
        regionBreakdown,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Get farmer stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve farmer statistics',
      error: error.message
    });
  }
});

// Find farmers near location
router.post('/nearby', async (req, res) => {
  try {
    const { latitude, longitude, maxDistance = 10000 } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const farmers = await Farmer.findNearLocation(latitude, longitude, maxDistance);

    res.json({
      status: 'success',
      data: {
        farmers,
        searchCenter: { latitude, longitude },
        maxDistance,
        count: farmers.length
      }
    });
  } catch (error) {
    console.error('Find nearby farmers error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to find nearby farmers',
      error: error.message
    });
  }
});

module.exports = router;