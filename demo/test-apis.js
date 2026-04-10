#!/usr/bin/env node

/**
 * AgriGuard API Demo Script
 * 
 * This script demonstrates the key features of the AgriGuard platform
 * including CAMARA API integration and automated claim processing.
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const DEMO_PHONE = '+254700123456'; // Kenya mobile number
const DEMO_LOCATION = { lat: -1.2921, lon: 36.8219 }; // Nairobi coordinates

class AgriGuardDemo {
  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 10000
    });
  }

  async runDemo() {
    console.log('🌾 AgriGuard Platform Demo');
    console.log('=' .repeat(50));
    
    try {
      // 1. Check API health
      await this.checkHealth();
      
      // 2. Register a farmer
      const farmer = await this.registerFarmer();
      
      // 3. Create insurance policy
      const policy = await this.createPolicy(farmer.farmer.id);
      
      // 4. Demonstrate CAMARA API calls
      await this.demonstrateCamaraAPIs();
      
      // 5. Submit and process claims
      await this.demonstrateClaimProcessing(farmer.farmer.id);
      
      // 6. Show system statistics
      await this.showSystemStats();
      
      console.log('\n✅ Demo completed successfully!');
      console.log('🔧 System is now monitoring policies for automatic claim detection.');
      
    } catch (error) {
      console.error('❌ Demo failed:', error.message);
      if (error.response) {
        console.error('Response:', error.response.data);
      }
    }
  }

  async checkHealth() {
    console.log('\n1. 🏥 Checking API Health...');
    const response = await this.client.get('/health');
    console.log('✅ API Status:', response.data.status);
    console.log('📅 Timestamp:', response.data.timestamp);
  }

  async registerFarmer() {
    console.log('\n2. 👨‍🌾 Registering Farmer...');
    
    const farmerData = {
      name: 'John Mwangi',
      phoneNumber: DEMO_PHONE,
      farmLocation: DEMO_LOCATION,
      cropTypes: ['maize', 'beans', 'coffee'],
      farmSize: 'medium'
    };

    const response = await this.client.post('/api/farmer/register', farmerData);
    
    console.log('✅ Farmer registered:', response.data.farmer.name);
    console.log('📱 Phone:', response.data.farmer.phoneNumber);
    console.log('📍 Location verified:', response.data.farmer.verification.location.verified);
    console.log('🛡️ Security status:', response.data.farmer.status);
    console.log('💳 Insurance eligible:', response.data.eligibleForInsurance);
    
    return response.data;
  }

  async createPolicy(farmerId) {
    console.log('\n3. 📋 Creating Insurance Policy...');
    
    const policyData = {
      farmerId,
      phoneNumber: DEMO_PHONE,
      fieldLocation: DEMO_LOCATION,
      cropType: 'maize',
      coverageAmount: 50000, // KES 50,000
      coverageType: ['drought', 'flood', 'connectivity']
    };

    const response = await this.client.post('/api/insurance/policy', policyData);
    
    console.log('✅ Policy created:', response.data.policyId);
    console.log('💰 Coverage amount: KES', response.data.policy.coverageAmount);
    console.log('🛡️ Coverage types:', response.data.policy.coverageType.join(', '));
    console.log('🔧 System monitoring:', response.data.systemMonitoring);
    
    return response.data;
  }

  async demonstrateCamaraAPIs() {
    console.log('\n4. 📡 Demonstrating CAMARA APIs...');
    
    // Location verification
    console.log('\n📍 Location API - Verifying farmer location...');
    const locationResponse = await this.client.post('/api/insurance/verify-location', {
      phoneNumber: DEMO_PHONE,
      expectedLat: DEMO_LOCATION.lat,
      expectedLon: DEMO_LOCATION.lon,
      radius: 1000
    });
    
    console.log('✅ Location verified:', locationResponse.data.verified);
    console.log('📏 Distance from expected:', locationResponse.data.distance, 'meters');
    
    // Security check (SIM Swap + Device Status)
    console.log('\n🔒 SIM Swap & Device Status APIs...');
    const securityResponse = await this.client.post('/api/insurance/check-security', {
      phoneNumber: DEMO_PHONE
    });
    
    console.log('📱 SIM swap detected:', securityResponse.data.simSwap.swapped);
    console.log('📶 Device status:', securityResponse.data.deviceStatus.status);
    console.log('🔗 Connection reliable:', securityResponse.data.deviceStatus.reliable);
    console.log('⚠️ Overall risk:', securityResponse.data.overallRisk);
  }

  async demonstrateClaimProcessing(farmerId) {
    console.log('\n5. 🔧 Automated Claim Processing...');
    
    // Drought claim
    console.log('\n🌵 Processing drought claim...');
    const droughtClaim = await this.client.post('/api/insurance/claim', {
      farmerId,
      claimType: 'drought',
      description: 'No rainfall for 3 weeks, crops are wilting',
      estimatedLoss: 30000,
      incidentDate: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString()
    });
    
    console.log('📋 Claim ID:', droughtClaim.data.claimId);
    console.log('✅ Status:', droughtClaim.data.status);
    console.log('🎯 Confidence:', droughtClaim.data.confidence + '%');
    console.log('💰 Payout amount: KES', droughtClaim.data.payoutAmount);
    console.log('🧠 Reasoning:', droughtClaim.data.reasoning.join(', '));
    
    // Flood claim
    console.log('\n🌊 Processing flood claim...');
    const floodClaim = await this.client.post('/api/insurance/claim', {
      farmerId,
      claimType: 'flood',
      description: 'Heavy rains caused flooding in the field',
      estimatedLoss: 25000,
      incidentDate: new Date().toISOString()
    });
    
    console.log('📋 Claim ID:', floodClaim.data.claimId);
    console.log('✅ Status:', floodClaim.data.status);
    console.log('🎯 Confidence:', floodClaim.data.confidence + '%');
    console.log('💰 Payout amount: KES', floodClaim.data.payoutAmount);
  }

  async showSystemStats() {
    console.log('\n6. 📊 System Statistics...');
    
    const statsResponse = await this.client.get('/api/insurance/stats');
    
    console.log('🔧 Active policies monitored:', statsResponse.data.activePolicies);
    console.log('🎯 System capabilities:', statsResponse.data.capabilities.join(', '));
    console.log('📏 Claim thresholds:', JSON.stringify(statsResponse.data.claimThresholds, null, 2));
  }

  async demonstrateWeatherAnalysis() {
    console.log('\n🌤️ Weather Analysis for Claims...');
    
    const weatherResponse = await this.client.get(
      `/api/insurance/weather/${DEMO_LOCATION.lat}/${DEMO_LOCATION.lon}?days=30&claimType=drought`
    );
    
    console.log('📊 Weather analysis:', weatherResponse.data.analysis);
    console.log('📅 Data period:', weatherResponse.data.period);
  }
}

// Run the demo
if (require.main === module) {
  const demo = new AgriGuardDemo();
  demo.runDemo().catch(console.error);
}

module.exports = AgriGuardDemo;