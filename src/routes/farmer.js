const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const camaraService = require('../services/camaraService');
const weatherService = require('../services/weatherService');

// Farmer registration/onboarding
router.post('/register', async (req, res) => {
  try {
    const { 
      name, 
      phoneNumber, 
      farmLocation, 
      cropTypes, 
      farmSize 
    } = req.body;

    if (!name || !phoneNumber || !farmLocation) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['name', 'phoneNumber', 'farmLocation']
      });
    }

    // Verify phone number and location
    const locationVerification = await camaraService.verifyLocation(
      phoneNumber,
      farmLocation.lat,
      farmLocation.lon,
      2000 // 2km radius for registration
    );

    // Check device status
    const deviceStatus = await camaraService.checkDeviceStatus(phoneNumber);

    // Check for SIM swap (security measure)
    const simSwapCheck = await camaraService.checkSimSwap(phoneNumber);

    const farmer = {
      id: `FARMER-${Date.now()}`,
      name,
      phoneNumber,
      farmLocation,
      cropTypes: cropTypes || [],
      farmSize: farmSize || 'small',
      registeredAt: new Date().toISOString(),
      verification: {
        location: locationVerification,
        device: deviceStatus,
        simSwap: simSwapCheck
      },
      status: locationVerification.verified && !simSwapCheck.swapped ? 'verified' : 'pending'
    };

    logger.info(`Farmer registered: ${name} (${phoneNumber})`);

    res.status(201).json({
      message: 'Farmer registration successful',
      farmer,
      eligibleForInsurance: farmer.status === 'verified'
    });

  } catch (error) {
    logger.error('Farmer registration failed:', error.message);
    res.status(500).json({ 
      error: 'Registration failed',
      message: error.message 
    });
  }
});

// Get farmer profile and current status
router.get('/profile/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;

    // In production, this would fetch from database
    // For demo, we'll perform real-time verification
    const [deviceStatus, simSwapCheck] = await Promise.all([
      camaraService.checkDeviceStatus(phoneNumber),
      camaraService.checkSimSwap(phoneNumber)
    ]);

    const profile = {
      phoneNumber,
      deviceStatus,
      simSwapStatus: simSwapCheck,
      lastChecked: new Date().toISOString(),
      accountSecurity: simSwapCheck.swapped ? 'at-risk' : 'secure',
      connectivity: deviceStatus.reliable ? 'good' : 'poor'
    };

    res.json(profile);

  } catch (error) {
    logger.error('Profile fetch failed:', error.message);
    res.status(500).json({ 
      error: 'Profile fetch failed',
      message: error.message 
    });
  }
});

// Get weather information for farmer's location
router.get('/weather/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const { days } = req.query;

    // First, get the farmer's current location
    const locationResponse = await camaraService.client.post('/location/v0/retrieve', {
      device: { phoneNumber },
      maxAge: 300
    });

    const { latitude, longitude } = locationResponse.data;

    // Get weather data
    const [currentWeather, weatherHistory] = await Promise.all([
      weatherService.getCurrentWeather(latitude, longitude),
      weatherService.getWeatherHistory(latitude, longitude, parseInt(days) || 7)
    ]);

    res.json({
      location: { latitude, longitude },
      current: currentWeather,
      history: weatherHistory,
      recommendations: generateWeatherRecommendations(currentWeather, weatherHistory)
    });

  } catch (error) {
    logger.error('Weather fetch failed:', error.message);
    res.status(500).json({ 
      error: 'Weather fetch failed',
      message: error.message 
    });
  }
});

// Send SMS notification (using device reachability)
router.post('/notify', async (req, res) => {
  try {
    const { phoneNumber, message, priority } = req.body;

    if (!phoneNumber || !message) {
      return res.status(400).json({ 
        error: 'Phone number and message required' 
      });
    }

    // Check if device is reachable
    const deviceStatus = await camaraService.checkDeviceStatus(phoneNumber);

    if (!deviceStatus.reliable) {
      return res.status(503).json({
        error: 'Device not reachable',
        status: deviceStatus.status,
        suggestion: 'Try again later when device has better connectivity'
      });
    }

    // In production, this would integrate with SMS gateway
    logger.info(`SMS notification sent to ${phoneNumber}: ${message}`);

    res.json({
      sent: true,
      phoneNumber,
      message,
      priority: priority || 'normal',
      deviceStatus: deviceStatus.status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Notification failed:', error.message);
    res.status(500).json({ 
      error: 'Notification failed',
      message: error.message 
    });
  }
});

// Emergency contact verification
router.post('/emergency-verify', async (req, res) => {
  try {
    const { phoneNumber, emergencyType, location } = req.body;

    if (!phoneNumber || !emergencyType) {
      return res.status(400).json({ 
        error: 'Phone number and emergency type required' 
      });
    }

    // Perform comprehensive verification for emergency situations
    const securityCheck = await camaraService.performSecurityCheck(
      phoneNumber,
      location?.lat || 0,
      location?.lon || 0
    );

    const emergencyResponse = {
      phoneNumber,
      emergencyType,
      verified: securityCheck.approved,
      riskAssessment: securityCheck.overallRiskScore,
      locationVerified: securityCheck.locationVerification.verified,
      deviceReachable: securityCheck.deviceStatus.reliable,
      accountSecure: !securityCheck.simSwapStatus.swapped,
      timestamp: new Date().toISOString(),
      priority: emergencyType === 'medical' ? 'critical' : 'high'
    };

    logger.info(`Emergency verification for ${phoneNumber}: ${emergencyResponse.verified ? 'VERIFIED' : 'FAILED'}`);

    res.json(emergencyResponse);

  } catch (error) {
    logger.error('Emergency verification failed:', error.message);
    res.status(500).json({ 
      error: 'Emergency verification failed',
      message: error.message 
    });
  }
});

// Get connectivity quality for farmer
router.get('/connectivity/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;

    const deviceStatus = await camaraService.checkDeviceStatus(phoneNumber);

    const connectivityReport = {
      phoneNumber,
      status: deviceStatus.status,
      reliable: deviceStatus.reliable,
      roaming: deviceStatus.roaming,
      quality: getConnectivityQuality(deviceStatus),
      recommendations: getConnectivityRecommendations(deviceStatus),
      timestamp: new Date().toISOString()
    };

    res.json(connectivityReport);

  } catch (error) {
    logger.error('Connectivity check failed:', error.message);
    res.status(500).json({ 
      error: 'Connectivity check failed',
      message: error.message 
    });
  }
});

// Helper function to generate weather recommendations
function generateWeatherRecommendations(current, history) {
  const recommendations = [];
  
  // Drought warning
  const recentRain = history.slice(-7).reduce((sum, day) => sum + day.precipitation, 0);
  if (recentRain < 10) {
    recommendations.push({
      type: 'drought-warning',
      message: 'Low rainfall detected. Consider water conservation measures.',
      priority: 'medium'
    });
  }

  // Flood warning
  if (current.precipitation > 50) {
    recommendations.push({
      type: 'flood-warning',
      message: 'Heavy rainfall expected. Ensure proper drainage.',
      priority: 'high'
    });
  }

  // Temperature advisory
  if (current.temperature > 35) {
    recommendations.push({
      type: 'heat-advisory',
      message: 'High temperatures. Protect crops and livestock.',
      priority: 'medium'
    });
  }

  return recommendations;
}

// Helper function to assess connectivity quality
function getConnectivityQuality(deviceStatus) {
  if (deviceStatus.status === 'CONNECTED_DATA' && !deviceStatus.roaming) {
    return 'excellent';
  } else if (deviceStatus.status === 'CONNECTED_DATA') {
    return 'good';
  } else if (deviceStatus.status === 'CONNECTED_SMS') {
    return 'limited';
  } else {
    return 'poor';
  }
}

// Helper function to provide connectivity recommendations
function getConnectivityRecommendations(deviceStatus) {
  const recommendations = [];
  
  if (!deviceStatus.reliable) {
    recommendations.push('Move to an area with better network coverage');
    recommendations.push('Try restarting your device');
  }
  
  if (deviceStatus.roaming) {
    recommendations.push('You are roaming - data charges may apply');
  }
  
  if (deviceStatus.status === 'CONNECTED_SMS') {
    recommendations.push('Only SMS available - data services limited');
  }
  
  return recommendations;
}

module.exports = router;