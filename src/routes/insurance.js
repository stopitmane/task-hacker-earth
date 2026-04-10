const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const camaraService = require('../services/camaraService');
const processingEngine = require('../services/processingEngine');
const weatherService = require('../services/weatherService');

// Create new insurance policy
router.post('/policy', async (req, res) => {
  try {
    const { 
      farmerId, 
      phoneNumber, 
      fieldLocation, 
      cropType, 
      coverageAmount, 
      coverageType 
    } = req.body;

    // Validate required fields
    if (!farmerId || !phoneNumber || !fieldLocation || !coverageAmount) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['farmerId', 'phoneNumber', 'fieldLocation', 'coverageAmount']
      });
    }

    // Perform initial security verification
    const securityCheck = await camaraService.performSecurityCheck(
      phoneNumber, 
      fieldLocation.lat, 
      fieldLocation.lon
    );

    if (!securityCheck.approved) {
      return res.status(403).json({
        error: 'Security verification failed',
        riskScore: securityCheck.overallRiskScore,
        details: securityCheck
      });
    }

    // Create policy
    const policy = {
      farmerId,
      phoneNumber,
      fieldLocation,
      cropType,
      coverageAmount,
      coverageType: coverageType || ['drought', 'flood'],
      startDate: new Date().toISOString(),
      status: 'active',
      securityVerification: securityCheck
    };

    // Register with processing engine for monitoring
    processingEngine.registerPolicy(farmerId, policy);

    logger.info(`Insurance policy created for farmer ${farmerId}`);

    res.status(201).json({
      message: 'Insurance policy created successfully',
      policyId: `POL-${farmerId}-${Date.now()}`,
      policy,
      systemMonitoring: true
    });

  } catch (error) {
    logger.error('Policy creation failed:', error.message);
    res.status(500).json({ 
      error: 'Policy creation failed',
      message: error.message 
    });
  }
});

// Submit insurance claim
router.post('/claim', async (req, res) => {
  try {
    const { 
      farmerId, 
      claimType, 
      description, 
      estimatedLoss,
      incidentDate 
    } = req.body;

    if (!farmerId || !claimType || !description) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['farmerId', 'claimType', 'description']
      });
    }

    logger.info(`Processing ${claimType} claim for farmer ${farmerId}`);

    // Processing engine assessment
    const claimData = {
      description,
      estimatedLoss,
      incidentDate: incidentDate || new Date().toISOString()
    };

    const decision = await processingEngine.processClaim(farmerId, claimType, claimData);

    // Log the decision
    logger.info(`Claim ${decision.claimId}: ${decision.approved ? 'APPROVED' : 'REJECTED'}`);

    res.json({
      claimId: decision.claimId,
      status: decision.approved ? 'approved' : 'rejected',
      confidence: decision.confidence,
      payoutAmount: decision.payoutAmount,
      reasoning: decision.reasoning,
      processedAt: decision.processedAt,
      systemProcessed: true
    });

  } catch (error) {
    logger.error('Claim processing failed:', error.message);
    res.status(500).json({ 
      error: 'Claim processing failed',
      message: error.message 
    });
  }
});

// Get policy status and monitoring data
router.get('/policy/:farmerId', async (req, res) => {
  try {
    const { farmerId } = req.params;
    
    // In production, this would fetch from database
    const policy = processingEngine.activePolicies.get(farmerId);
    
    if (!policy) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    // Get current weather conditions for the field
    const currentWeather = await weatherService.getCurrentWeather(
      policy.fieldLocation.lat,
      policy.fieldLocation.lon
    );

    res.json({
      policy,
      currentWeather,
      systemMonitoring: true,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Policy fetch failed:', error.message);
    res.status(500).json({ 
      error: 'Policy fetch failed',
      message: error.message 
    });
  }
});

// Verify farmer location (for mobile app)
router.post('/verify-location', async (req, res) => {
  try {
    const { phoneNumber, expectedLat, expectedLon, radius } = req.body;

    if (!phoneNumber || !expectedLat || !expectedLon) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['phoneNumber', 'expectedLat', 'expectedLon']
      });
    }

    const locationCheck = await camaraService.verifyLocation(
      phoneNumber, 
      expectedLat, 
      expectedLon, 
      radius || 1000
    );

    res.json({
      verified: locationCheck.verified,
      distance: locationCheck.distance,
      accuracy: locationCheck.actualLocation.accuracy,
      timestamp: locationCheck.timestamp
    });

  } catch (error) {
    logger.error('Location verification failed:', error.message);
    res.status(500).json({ 
      error: 'Location verification failed',
      message: error.message 
    });
  }
});

// Check SIM swap status
router.post('/check-security', async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ 
        error: 'Phone number required' 
      });
    }

    const simSwapCheck = await camaraService.checkSimSwap(phoneNumber);
    const deviceStatus = await camaraService.checkDeviceStatus(phoneNumber);

    res.json({
      phoneNumber,
      simSwap: simSwapCheck,
      deviceStatus,
      overallRisk: simSwapCheck.riskLevel,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Security check failed:', error.message);
    res.status(500).json({ 
      error: 'Security check failed',
      message: error.message 
    });
  }
});

// Get weather analysis for location
router.get('/weather/:lat/:lon', async (req, res) => {
  try {
    const { lat, lon } = req.params;
    const { days, claimType } = req.query;

    const weatherHistory = await weatherService.getWeatherHistory(
      parseFloat(lat), 
      parseFloat(lon), 
      parseInt(days) || 30
    );

    let analysis = null;
    if (claimType) {
      analysis = weatherService.analyzeWeatherPatterns(weatherHistory, claimType);
    }

    res.json({
      location: { lat: parseFloat(lat), lon: parseFloat(lon) },
      weatherHistory,
      analysis,
      period: `${weatherHistory.length} days`,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Weather analysis failed:', error.message);
    res.status(500).json({ 
      error: 'Weather analysis failed',
      message: error.message 
    });
  }
});

// Get system statistics
router.get('/stats', (req, res) => {
  try {
    const stats = processingEngine.getSystemStats();
    res.json(stats);
  } catch (error) {
    logger.error('System stats fetch failed:', error.message);
    res.status(500).json({ 
      error: 'System stats fetch failed',
      message: error.message 
    });
  }
});

module.exports = router;