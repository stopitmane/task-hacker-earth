const logger = require('../utils/logger');
const camaraService = require('./camaraService');
const weatherService = require('./weatherService');

class ProcessingEngine {
  constructor() {
    this.activePolicies = new Map(); // In production, this would be a database
    this.claimThresholds = {
      drought: { minDays: 14, precipitationThreshold: 5 }, // mm
      flood: { precipitationThreshold: 100 }, // mm in 24h
      connectivity: { minReliabilityScore: 70 }
    };
  }

  // Main claim processing engine
  async processClaim(farmerId, claimType, claimData) {
    try {
      logger.info(`Processing ${claimType} claim for farmer ${farmerId}`);
      
      const policy = this.activePolicies.get(farmerId);
      if (!policy) {
        throw new Error('No active policy found for farmer');
      }

      // Perform comprehensive verification
      const verification = await this.performVerification(policy, claimData);
      
      // Make decision based on verification results
      const decision = await this.makeDecision(claimType, verification, policy);
      
      // Log decision for audit trail
      logger.info(`Decision for ${farmerId}: ${decision.approved ? 'APPROVED' : 'REJECTED'} - Confidence: ${decision.confidence}%`);
      
      return decision;
    } catch (error) {
      logger.error('Claim processing failed:', error.message);
      throw error;
    }
  }

  // Comprehensive verification using all CAMARA APIs
  async performVerification(policy, claimData) {
    const { phoneNumber, fieldLocation } = policy;
    const { lat, lon } = fieldLocation;

    try {
      // Multi-API verification
      const [securityCheck, weatherData] = await Promise.all([
        camaraService.performSecurityCheck(phoneNumber, lat, lon),
        weatherService.getWeatherHistory(lat, lon, 30) // Last 30 days
      ]);

      return {
        security: securityCheck,
        weather: weatherData,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Verification failed:', error.message);
      throw error;
    }
  }

  // Decision-making algorithm
  async makeDecision(claimType, verification, policy) {
    let confidence = 0;
    let approved = false;
    let reasoning = [];

    // Security checks (40% weight)
    const securityScore = this.evaluateSecurityScore(verification.security);
    confidence += securityScore * 0.4;
    
    if (verification.security.approved) {
      reasoning.push('Security verification passed');
    } else {
      reasoning.push(`Security risk detected: Score ${verification.security.overallRiskScore}`);
    }

    // Weather-based claim validation (50% weight)
    const weatherScore = this.evaluateWeatherClaim(claimType, verification.weather);
    confidence += weatherScore * 0.5;
    
    // Policy compliance (10% weight)
    const policyScore = this.evaluatePolicyCompliance(policy);
    confidence += policyScore * 0.1;

    // Final decision threshold
    approved = confidence >= 70 && verification.security.approved;

    return {
      approved,
      confidence: Math.round(confidence),
      reasoning,
      payoutAmount: approved ? this.calculatePayout(policy, claimType, confidence) : 0,
      claimId: this.generateClaimId(),
      processedAt: new Date().toISOString(),
      systemVersion: '1.0.0'
    };
  }

  // Evaluate security verification results
  evaluateSecurityScore(securityCheck) {
    let score = 100;
    
    // Location verification
    if (!securityCheck.locationVerification.verified) {
      score -= 30;
    }
    
    // SIM swap detection
    if (securityCheck.simSwapStatus.swapped) {
      score -= 50; // Major red flag
    }
    
    // Device connectivity
    if (!securityCheck.deviceStatus.reliable) {
      score -= 20;
    }
    
    return Math.max(score, 0);
  }

  // Evaluate weather-based claims
  evaluateWeatherClaim(claimType, weatherData) {
    switch (claimType) {
      case 'drought':
        return this.evaluateDroughtClaim(weatherData);
      case 'flood':
        return this.evaluateFloodClaim(weatherData);
      case 'connectivity':
        return this.evaluateConnectivityClaim(weatherData);
      default:
        return 50; // Neutral score for unknown claim types
    }
  }

  evaluateDroughtClaim(weatherData) {
    const { minDays, precipitationThreshold } = this.claimThresholds.drought;
    const dryDays = weatherData.filter(day => day.precipitation < precipitationThreshold).length;
    
    if (dryDays >= minDays) {
      return 90; // Strong evidence of drought
    } else if (dryDays >= minDays * 0.7) {
      return 60; // Moderate evidence
    }
    return 20; // Insufficient evidence
  }

  evaluateFloodClaim(weatherData) {
    const { precipitationThreshold } = this.claimThresholds.flood;
    const maxDailyPrecipitation = Math.max(...weatherData.map(day => day.precipitation));
    
    if (maxDailyPrecipitation >= precipitationThreshold) {
      return 95; // Clear flood conditions
    } else if (maxDailyPrecipitation >= precipitationThreshold * 0.7) {
      return 70; // Heavy rain, possible flooding
    }
    return 25; // Normal precipitation
  }

  evaluateConnectivityClaim(weatherData) {
    // For connectivity claims, check if weather conditions affected network
    const severeDays = weatherData.filter(day => 
      day.precipitation > 50 || day.windSpeed > 15
    ).length;
    
    return severeDays > 5 ? 80 : 40;
  }

  evaluatePolicyCompliance(policy) {
    const now = new Date();
    const policyStart = new Date(policy.startDate);
    const daysSinceStart = (now - policyStart) / (1000 * 60 * 60 * 24);
    
    // Policy must be active for at least 7 days before claims
    return daysSinceStart >= 7 ? 100 : 50;
  }

  // Calculate payout amount based on confidence and policy terms
  calculatePayout(policy, claimType, confidence) {
    const basePayout = policy.coverageAmount;
    const confidenceMultiplier = confidence / 100;
    
    // Adjust payout based on claim type
    const typeMultipliers = {
      drought: 0.8,
      flood: 1.0,
      connectivity: 0.6
    };
    
    const typeMultiplier = typeMultipliers[claimType] || 0.7;
    
    return Math.round(basePayout * confidenceMultiplier * typeMultiplier);
  }

  // Monitor active policies for automatic claim detection
  async monitorActivePolicies() {
    logger.info('System monitoring active policies...');
    
    for (const [farmerId, policy] of this.activePolicies) {
      try {
        await this.checkForAutomaticClaims(farmerId, policy);
      } catch (error) {
        logger.error(`Monitoring failed for farmer ${farmerId}:`, error.message);
      }
    }
  }

  // Proactive claim detection based on weather and network data
  async checkForAutomaticClaims(farmerId, policy) {
    const { fieldLocation } = policy;
    const { lat, lon } = fieldLocation;
    
    // Get recent weather data
    const weatherData = await weatherService.getWeatherHistory(lat, lon, 7);
    
    // Check for drought conditions
    const dryDays = weatherData.filter(day => day.precipitation < 5).length;
    if (dryDays >= 7) {
      logger.info(`Potential drought detected for farmer ${farmerId}`);
      // In production, this would trigger an automatic claim assessment
    }
    
    // Check for flood conditions
    const maxPrecipitation = Math.max(...weatherData.map(day => day.precipitation));
    if (maxPrecipitation >= 100) {
      logger.info(`Potential flood detected for farmer ${farmerId}`);
      // In production, this would trigger an automatic claim assessment
    }
  }

  // Register a new policy for monitoring
  registerPolicy(farmerId, policyData) {
    this.activePolicies.set(farmerId, {
      ...policyData,
      registeredAt: new Date().toISOString()
    });
    logger.info(`Policy registered for farmer ${farmerId}`);
  }

  // Generate unique claim ID
  generateClaimId() {
    return `AG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get system statistics
  getSystemStats() {
    return {
      activePolicies: this.activePolicies.size,
      claimThresholds: this.claimThresholds,
      version: '1.0.0',
      capabilities: ['Location Verification', 'SIM Swap Detection', 'Weather Analysis', 'Automated Claims']
    };
  }
}

module.exports = new ProcessingEngine();