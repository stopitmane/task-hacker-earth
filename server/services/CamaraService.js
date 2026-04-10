const axios = require('axios');

class CamaraService {
  constructor() {
    this.baseURL = process.env.NOKIA_API_BASE_URL;
    this.apiKey = process.env.NOKIA_API_KEY;
    this.clientId = process.env.NOKIA_CLIENT_ID;
    this.clientSecret = process.env.NOKIA_CLIENT_SECRET;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async authenticate() {
    try {
      if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return this.accessToken;
      }

      const response = await axios.post(`${this.baseURL}/auth/token`, {
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
      
      console.log('🔐 CAMARA API authenticated successfully');
      return this.accessToken;
    } catch (error) {
      console.error('❌ CAMARA authentication failed:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with CAMARA API');
    }
  }

  async makeRequest(endpoint, method = 'GET', data = null) {
    try {
      const token = await this.authenticate();
      
      const config = {
        method,
        url: `${this.baseURL}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        }
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error(`❌ CAMARA API request failed for ${endpoint}:`, error.response?.data || error.message);
      throw error;
    }
  }

  // Location API - Verify farmer location
  async verifyLocation(phoneNumber, expectedLocation) {
    try {
      const locationData = await this.makeRequest('/location/verify', 'POST', {
        device: {
          phoneNumber: phoneNumber
        },
        area: {
          areaType: 'Circle',
          center: {
            latitude: expectedLocation.latitude,
            longitude: expectedLocation.longitude
          },
          radius: expectedLocation.radius || 1000 // 1km default radius
        },
        maxAge: 300 // 5 minutes
      });

      return {
        verified: locationData.verificationResult === 'TRUE',
        confidence: locationData.matchRate || 0,
        timestamp: new Date().toISOString(),
        location: locationData.lastLocationTime
      };
    } catch (error) {
      console.error('❌ Location verification failed:', error);
      return { verified: false, error: error.message };
    }
  }

  // SIM Swap API - Detect fraud attempts
  async checkSimSwap(phoneNumber, maxAge = 240) {
    try {
      const simSwapData = await this.makeRequest('/sim-swap/check', 'POST', {
        phoneNumber: phoneNumber,
        maxAge: maxAge // 4 hours default
      });

      return {
        swapped: simSwapData.swapped || false,
        swapDate: simSwapData.latestSimChange,
        riskLevel: simSwapData.swapped ? 'HIGH' : 'LOW',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ SIM swap check failed:', error);
      return { swapped: false, riskLevel: 'UNKNOWN', error: error.message };
    }
  }

  // Device Status API - Check connectivity
  async getDeviceStatus(phoneNumber) {
    try {
      const deviceData = await this.makeRequest('/device-status/roaming', 'POST', {
        device: {
          phoneNumber: phoneNumber
        }
      });

      return {
        roaming: deviceData.roaming || false,
        countryCode: deviceData.countryCode,
        countryName: deviceData.countryName,
        connectivity: 'ACTIVE',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Device status check failed:', error);
      return { connectivity: 'UNKNOWN', error: error.message };
    }
  }

  // Number Verification API - Secure authentication
  async verifyNumber(phoneNumber, code) {
    try {
      const verificationData = await this.makeRequest('/number-verification/verify', 'POST', {
        phoneNumber: phoneNumber,
        code: code
      });

      return {
        verified: verificationData.devicePhoneNumberVerified || false,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Number verification failed:', error);
      return { verified: false, error: error.message };
    }
  }

  // Quality on Demand API - Ensure reliable connectivity for critical operations
  async requestQoD(phoneNumber, duration = 3600) {
    try {
      const qodData = await this.makeRequest('/qod/sessions', 'POST', {
        device: {
          phoneNumber: phoneNumber
        },
        applicationServer: {
          ipv4Address: process.env.SERVER_IP || '0.0.0.0'
        },
        qosProfile: 'QOS_L', // Low latency profile for financial transactions
        duration: duration, // 1 hour default
        notificationUrl: `${process.env.SERVER_URL}/api/camara/qod-callback`
      });

      return {
        sessionId: qodData.sessionId,
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + duration * 1000).toISOString(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ QoD session creation failed:', error);
      return { status: 'FAILED', error: error.message };
    }
  }

  // Comprehensive farmer verification combining multiple APIs
  async comprehensiveVerification(phoneNumber, expectedLocation, farmerId) {
    console.log(`🔍 Starting comprehensive verification for farmer ${farmerId}`);
    
    const results = {
      farmerId,
      phoneNumber,
      timestamp: new Date().toISOString(),
      overallRisk: 'LOW',
      verified: true,
      checks: {}
    };

    try {
      // Parallel API calls for efficiency
      const [locationCheck, simSwapCheck, deviceStatus] = await Promise.allSettled([
        this.verifyLocation(phoneNumber, expectedLocation),
        this.checkSimSwap(phoneNumber),
        this.getDeviceStatus(phoneNumber)
      ]);

      // Process location verification
      if (locationCheck.status === 'fulfilled') {
        results.checks.location = locationCheck.value;
        if (!locationCheck.value.verified) {
          results.overallRisk = 'MEDIUM';
          results.verified = false;
        }
      }

      // Process SIM swap check
      if (simSwapCheck.status === 'fulfilled') {
        results.checks.simSwap = simSwapCheck.value;
        if (simSwapCheck.value.swapped) {
          results.overallRisk = 'HIGH';
          results.verified = false;
        }
      }

      // Process device status
      if (deviceStatus.status === 'fulfilled') {
        results.checks.deviceStatus = deviceStatus.value;
      }

      // Calculate overall confidence score
      let confidenceScore = 100;
      if (!results.checks.location?.verified) confidenceScore -= 40;
      if (results.checks.simSwap?.swapped) confidenceScore -= 50;
      if (results.checks.deviceStatus?.connectivity === 'UNKNOWN') confidenceScore -= 10;

      results.confidenceScore = Math.max(0, confidenceScore);
      
      console.log(`✅ Verification complete for farmer ${farmerId}: ${results.overallRisk} risk, ${results.confidenceScore}% confidence`);
      
      return results;
    } catch (error) {
      console.error('❌ Comprehensive verification failed:', error);
      return {
        ...results,
        overallRisk: 'HIGH',
        verified: false,
        error: error.message
      };
    }
  }
}

module.exports = new CamaraService();