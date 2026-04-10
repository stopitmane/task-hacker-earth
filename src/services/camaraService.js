const axios = require('axios');
const logger = require('../utils/logger');

class CamaraService {
  constructor() {
    this.baseURL = process.env.NOKIA_NAC_BASE_URL;
    this.apiKey = process.env.NOKIA_API_KEY;
    this.clientId = process.env.NOKIA_CLIENT_ID;
    this.clientSecret = process.env.NOKIA_CLIENT_SECRET;
    
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  // Location API - Verify farmer location and field boundaries
  async verifyLocation(phoneNumber, expectedLat, expectedLon, radius = 1000) {
    try {
      logger.info(`Verifying location for ${phoneNumber}`);
      
      const response = await this.client.post('/location/v0/retrieve', {
        device: {
          phoneNumber: phoneNumber
        },
        maxAge: 300 // 5 minutes
      });

      const { latitude, longitude, accuracy } = response.data;
      
      // Calculate distance between expected and actual location
      const distance = this.calculateDistance(
        expectedLat, expectedLon, 
        latitude, longitude
      );

      const isWithinBounds = distance <= radius;
      
      logger.info(`Location verification: ${isWithinBounds ? 'PASSED' : 'FAILED'} - Distance: ${distance}m`);
      
      return {
        verified: isWithinBounds,
        actualLocation: { latitude, longitude, accuracy },
        expectedLocation: { latitude: expectedLat, longitude: expectedLon },
        distance: distance,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Location verification failed:', error.message);
      throw new Error(`Location API error: ${error.message}`);
    }
  }

  // SIM Swap API - Detect fraud attempts
  async checkSimSwap(phoneNumber, maxAge = 240) {
    try {
      logger.info(`Checking SIM swap status for ${phoneNumber}`);
      
      const response = await this.client.post('/sim-swap/v0/check', {
        phoneNumber: phoneNumber,
        maxAge: maxAge // 4 hours in minutes
      });

      const { swapped, swapDate } = response.data;
      
      if (swapped) {
        logger.warn(`SIM SWAP DETECTED for ${phoneNumber} on ${swapDate}`);
      }
      
      return {
        phoneNumber,
        swapped,
        swapDate: swapDate || null,
        checkTime: new Date().toISOString(),
        riskLevel: swapped ? 'HIGH' : 'LOW'
      };
    } catch (error) {
      logger.error('SIM swap check failed:', error.message);
      throw new Error(`SIM Swap API error: ${error.message}`);
    }
  }

  // Device Status API - Check connectivity reliability
  async checkDeviceStatus(phoneNumber) {
    try {
      logger.info(`Checking device status for ${phoneNumber}`);
      
      const response = await this.client.post('/device-status/v0/connectivity', {
        device: {
          phoneNumber: phoneNumber
        }
      });

      const { connectivityStatus, roaming } = response.data;
      
      return {
        phoneNumber,
        status: connectivityStatus, // CONNECTED_SMS, CONNECTED_DATA, NOT_CONNECTED
        roaming,
        reliable: connectivityStatus === 'CONNECTED_DATA',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Device status check failed:', error.message);
      throw new Error(`Device Status API error: ${error.message}`);
    }
  }

  // Comprehensive security check combining all APIs
  async performSecurityCheck(phoneNumber, expectedLat, expectedLon) {
    try {
      logger.info(`Performing comprehensive security check for ${phoneNumber}`);
      
      const [locationCheck, simSwapCheck, deviceCheck] = await Promise.all([
        this.verifyLocation(phoneNumber, expectedLat, expectedLon),
        this.checkSimSwap(phoneNumber),
        this.checkDeviceStatus(phoneNumber)
      ]);

      const riskScore = this.calculateRiskScore(locationCheck, simSwapCheck, deviceCheck);
      
      return {
        phoneNumber,
        locationVerification: locationCheck,
        simSwapStatus: simSwapCheck,
        deviceStatus: deviceCheck,
        overallRiskScore: riskScore,
        approved: riskScore < 50, // Approve if risk score below 50
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Security check failed:', error.message);
      throw error;
    }
  }

  // Helper method to calculate distance between two coordinates
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  }

  // Calculate risk score based on all checks
  calculateRiskScore(locationCheck, simSwapCheck, deviceCheck) {
    let score = 0;
    
    // Location risk (0-30 points)
    if (!locationCheck.verified) score += 30;
    else if (locationCheck.distance > 500) score += 15;
    
    // SIM swap risk (0-50 points)
    if (simSwapCheck.swapped) score += 50;
    
    // Device connectivity risk (0-20 points)
    if (!deviceCheck.reliable) score += 20;
    if (deviceCheck.roaming) score += 10;
    
    return Math.min(score, 100); // Cap at 100
  }
}

module.exports = new CamaraService();