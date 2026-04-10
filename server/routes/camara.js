const express = require('express');
const router = express.Router();
const CamaraService = require('../services/CamaraService');
const Farmer = require('../models/Farmer');

// Test CAMARA API connectivity
router.get('/test', async (req, res) => {
  try {
    const token = await CamaraService.authenticate();
    res.json({ 
      status: 'success', 
      message: 'CAMARA API connection successful',
      authenticated: !!token,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: 'CAMARA API connection failed',
      error: error.message 
    });
  }
});

// Verify farmer location
router.post('/verify-location', async (req, res) => {
  try {
    const { phoneNumber, expectedLocation } = req.body;
    
    if (!phoneNumber || !expectedLocation) {
      return res.status(400).json({ 
        error: 'Phone number and expected location are required' 
      });
    }

    const result = await CamaraService.verifyLocation(phoneNumber, expectedLocation);
    
    // Update farmer's network intelligence if farmerId provided
    if (req.body.farmerId) {
      const farmer = await Farmer.findOne({ farmerId: req.body.farmerId });
      if (farmer) {
        await farmer.updateNetworkIntelligence({ locationCheck: result });
      }
    }

    res.json({
      status: 'success',
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Location verification error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Location verification failed',
      error: error.message 
    });
  }
});

// Check SIM swap status
router.post('/check-sim-swap', async (req, res) => {
  try {
    const { phoneNumber, maxAge } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ 
        error: 'Phone number is required' 
      });
    }

    const result = await CamaraService.checkSimSwap(phoneNumber, maxAge);
    
    // Update farmer's network intelligence if farmerId provided
    if (req.body.farmerId) {
      const farmer = await Farmer.findOne({ farmerId: req.body.farmerId });
      if (farmer) {
        await farmer.updateNetworkIntelligence({ simSwapCheck: result });
      }
    }

    res.json({
      status: 'success',
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('SIM swap check error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'SIM swap check failed',
      error: error.message 
    });
  }
});

// Get device status
router.post('/device-status', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ 
        error: 'Phone number is required' 
      });
    }

    const result = await CamaraService.getDeviceStatus(phoneNumber);
    
    // Update farmer's network intelligence if farmerId provided
    if (req.body.farmerId) {
      const farmer = await Farmer.findOne({ farmerId: req.body.farmerId });
      if (farmer) {
        await farmer.updateNetworkIntelligence({ deviceStatus: result });
      }
    }

    res.json({
      status: 'success',
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Device status check error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Device status check failed',
      error: error.message 
    });
  }
});

// Verify phone number
router.post('/verify-number', async (req, res) => {
  try {
    const { phoneNumber, code } = req.body;
    
    if (!phoneNumber || !code) {
      return res.status(400).json({ 
        error: 'Phone number and verification code are required' 
      });
    }

    const result = await CamaraService.verifyNumber(phoneNumber, code);
    
    // Update farmer verification status if farmerId provided
    if (req.body.farmerId && result.verified) {
      const farmer = await Farmer.findOne({ farmerId: req.body.farmerId });
      if (farmer) {
        farmer.verification.phoneVerified = true;
        farmer.verification.verificationDate = new Date();
        await farmer.save();
      }
    }

    res.json({
      status: 'success',
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Number verification error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Number verification failed',
      error: error.message 
    });
  }
});

// Request Quality on Demand session
router.post('/request-qod', async (req, res) => {
  try {
    const { phoneNumber, duration } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ 
        error: 'Phone number is required' 
      });
    }

    const result = await CamaraService.requestQoD(phoneNumber, duration);

    res.json({
      status: 'success',
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('QoD request error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'QoD request failed',
      error: error.message 
    });
  }
});

// Comprehensive farmer verification (combines multiple APIs)
router.post('/comprehensive-verification', async (req, res) => {
  try {
    const { phoneNumber, expectedLocation, farmerId } = req.body;
    
    if (!phoneNumber || !expectedLocation || !farmerId) {
      return res.status(400).json({ 
        error: 'Phone number, expected location, and farmer ID are required' 
      });
    }

    console.log(`🔍 Starting comprehensive verification for farmer ${farmerId}`);
    
    const result = await CamaraService.comprehensiveVerification(
      phoneNumber, 
      expectedLocation, 
      farmerId
    );
    
    // Update farmer record with verification results
    const farmer = await Farmer.findOne({ farmerId });
    if (farmer) {
      // Update network intelligence
      await farmer.updateNetworkIntelligence({
        locationCheck: result.checks.location,
        simSwapCheck: result.checks.simSwap,
        deviceStatus: result.checks.deviceStatus
      });
      
      // Update verification status
      farmer.verification.locationVerified = result.checks.location?.verified || false;
      farmer.verification.verificationScore = result.confidenceScore;
      farmer.verification.verificationDate = new Date();
      
      // Update risk profile based on results
      let riskLevel = 'LOW';
      if (result.overallRisk === 'HIGH') riskLevel = 'HIGH';
      else if (result.overallRisk === 'MEDIUM') riskLevel = 'MEDIUM';
      
      farmer.riskProfile.riskLevel = riskLevel;
      farmer.riskProfile.riskScore = 100 - result.confidenceScore;
      farmer.riskProfile.lastRiskAssessment = new Date();
      
      await farmer.save();
      
      console.log(`✅ Farmer ${farmerId} verification complete and saved`);
    }

    // Emit real-time update if socket available
    if (req.io) {
      req.io.to(`farmer-${farmerId}`).emit('verification-complete', {
        farmerId,
        result,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      status: 'success',
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Comprehensive verification error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Comprehensive verification failed',
      error: error.message 
    });
  }
});

// QoD callback endpoint (for Nokia to send status updates)
router.post('/qod-callback', async (req, res) => {
  try {
    console.log('📞 QoD callback received:', req.body);
    
    const { sessionId, event, timestamp } = req.body;
    
    // Process QoD event (session started, ended, etc.)
    // This would typically update session status in database
    
    // Emit real-time update if socket available
    if (req.io) {
      req.io.emit('qod-update', {
        sessionId,
        event,
        timestamp
      });
    }

    res.json({ 
      status: 'success', 
      message: 'QoD callback processed' 
    });
  } catch (error) {
    console.error('QoD callback error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'QoD callback processing failed',
      error: error.message 
    });
  }
});

// Get CAMARA API usage statistics
router.get('/stats', async (req, res) => {
  try {
    // This would typically come from a usage tracking system
    const stats = {
      totalRequests: 1250,
      successRate: 98.4,
      averageResponseTime: 245, // ms
      apiUsage: {
        location: 450,
        simSwap: 320,
        deviceStatus: 280,
        numberVerification: 150,
        qod: 50
      },
      lastUpdated: new Date().toISOString()
    };

    res.json({
      status: 'success',
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Stats retrieval error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to retrieve stats',
      error: error.message 
    });
  }
});

module.exports = router;