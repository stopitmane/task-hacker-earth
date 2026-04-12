const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const camaraService = require('../services/camaraService');
const processingEngine = require('../services/processingEngine');
const weatherService = require('../services/weatherService');

// Import security middleware
const { authenticateJWT, authenticateApiKey, authorize, requirePermission } = require('../middleware/auth');
const { claimRateLimit, camaraRateLimit } = require('../middleware/rateLimiting');
const { validationSchemas, handleValidationErrors } = require('../middleware/security');

// Create new insurance policy (requires authentication)
router.post('/policy', 
  authenticateJWT, 
  authorize('farmer', 'admin'), 
  validationSchemas.policyCreation, 
  handleValidationErrors, 
  async (req, res) => {
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

    logger.business(`Insurance policy created for farmer ${farmerId}`, {
      userId: req.user.id,
      policyId: `POL-${farmerId}-${Date.now()}`,
      coverageAmount,
      ip: req.ip
    });

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

// Submit insurance claim (requires authentication and rate limiting)
router.post('/claim', 
  authenticateJWT, 
  authorize('farmer', 'admin'),
  claimRateLimit,
  validationSchemas.claimSubmission, 
  handleValidationErrors, 
  async (req, res) => {
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
    logger.business(`Claim ${decision.claimId}: ${decision.approved ? 'APPROVED' : 'REJECTED'}`, {
      userId: req.user.id,
      farmerId,
      claimType,
      payoutAmount: decision.payoutAmount,
      confidence: decision.confidence,
      ip: req.ip
    });

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

// Verify farmer location (requires API key or JWT)
router.post('/verify-location', 
  (req, res, next) => {
    // Allow either JWT or API key authentication
    if (req.headers.authorization) {
      return authenticateJWT(req, res, next);
    } else if (req.headers['x-api-key']) {
      return authenticateApiKey(req, res, next);
    } else {
      return res.status(401).json({ error: 'Authentication required' });
    }
  },
  camaraRateLimit,
  requirePermission('camara:location'),
  validationSchemas.locationVerification,
  handleValidationErrors,
  async (req, res) => {
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

// Check SIM swap status (requires API key or JWT)
router.post('/check-security', 
  (req, res, next) => {
    if (req.headers.authorization) {
      return authenticateJWT(req, res, next);
    } else if (req.headers['x-api-key']) {
      return authenticateApiKey(req, res, next);
    } else {
      return res.status(401).json({ error: 'Authentication required' });
    }
  },
  camaraRateLimit,
  requirePermission('camara:sim-swap'),
  async (req, res) => {
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

// Get system statistics (admin only)
router.get('/stats', authenticateJWT, authorize('admin'), (req, res) => {
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