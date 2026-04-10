const OpenAI = require('openai');
const CamaraService = require('../services/CamaraService');

class FraudDetectionAgent {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.name = 'FraudDetectionAgent';
    this.version = '1.0.0';
    this.suspiciousPatterns = new Map();
    this.riskThresholds = {
      LOW: 25,
      MEDIUM: 50,
      HIGH: 75,
      CRITICAL: 90
    };
  }

  async analyzeFraudRisk(farmerData, transactionData = null) {
    console.log(`🕵️ ${this.name}: Analyzing fraud risk for farmer ${farmerData.farmerId}`);
    
    try {
      // Step 1: Network-based fraud detection
      const networkAnalysis = await this.performNetworkAnalysis(farmerData);
      
      // Step 2: Behavioral pattern analysis
      const behaviorAnalysis = await this.analyzeBehaviorPatterns(farmerData, transactionData);
      
      // Step 3: AI-powered risk assessment
      const aiRiskAssessment = await this.performAIRiskAssessment(farmerData, networkAnalysis, behaviorAnalysis);
      
      // Step 4: Generate comprehensive fraud report
      const fraudReport = await this.generateFraudReport(farmerData, networkAnalysis, behaviorAnalysis, aiRiskAssessment);
      
      console.log(`✅ ${this.name}: Fraud analysis complete - Risk Level: ${fraudReport.riskLevel}`);
      
      return fraudReport;
    } catch (error) {
      console.error(`❌ ${this.name}: Fraud analysis failed:`, error);
      return {
        farmerId: farmerData.farmerId,
        riskLevel: 'HIGH',
        riskScore: 100,
        reasoning: 'Analysis failed - defaulting to high risk',
        error: error.message,
        timestamp: new Date().toISOString(),
        agent: this.name
      };
    }
  }

  async performNetworkAnalysis(farmerData) {
    console.log(`📡 ${this.name}: Performing network-based fraud analysis...`);
    
    const analysis = {
      simSwapRisk: 0,
      locationConsistency: 100,
      deviceFingerprint: 'CONSISTENT',
      networkAnomalies: []
    };

    try {
      if (farmerData.phoneNumber) {
        // Check for recent SIM swaps
        const simSwapCheck = await CamaraService.checkSimSwap(farmerData.phoneNumber, 168); // 7 days
        if (simSwapCheck.swapped) {
          analysis.simSwapRisk = 85;
          analysis.networkAnomalies.push({
            type: 'SIM_SWAP',
            severity: 'HIGH',
            details: `SIM swap detected on ${simSwapCheck.swapDate}`,
            riskContribution: 40
          });
        }

        // Verify location consistency
        if (farmerData.registeredLocation) {
          const locationCheck = await CamaraService.verifyLocation(
            farmerData.phoneNumber,
            farmerData.registeredLocation
          );
          
          if (!locationCheck.verified) {
            analysis.locationConsistency = locationCheck.confidence || 0;
            analysis.networkAnomalies.push({
              type: 'LOCATION_MISMATCH',
              severity: 'MEDIUM',
              details: 'Current location does not match registered farm location',
              riskContribution: 25
            });
          }
        }

        // Check device status for roaming anomalies
        const deviceStatus = await CamaraService.getDeviceStatus(farmerData.phoneNumber);
        if (deviceStatus.roaming && !farmerData.expectedRoaming) {
          analysis.networkAnomalies.push({
            type: 'UNEXPECTED_ROAMING',
            severity: 'MEDIUM',
            details: `Device roaming in ${deviceStatus.countryName}`,
            riskContribution: 20
          });
        }
      }

      return analysis;
    } catch (error) {
      console.error(`❌ ${this.name}: Network analysis failed:`, error);
      analysis.networkAnomalies.push({
        type: 'ANALYSIS_ERROR',
        severity: 'HIGH',
        details: 'Network analysis failed',
        riskContribution: 30
      });
      return analysis;
    }
  }

  async analyzeBehaviorPatterns(farmerData, transactionData) {
    console.log(`🔍 ${this.name}: Analyzing behavioral patterns...`);
    
    const patterns = {
      claimFrequency: 'NORMAL',
      amountPatterns: 'NORMAL',
      timingPatterns: 'NORMAL',
      suspiciousIndicators: []
    };

    try {
      // Analyze claim frequency
      if (farmerData.claimHistory && farmerData.claimHistory.length > 0) {
        const recentClaims = farmerData.claimHistory.filter(claim => 
          new Date(claim.date) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
        );

        if (recentClaims.length > 3) {
          patterns.claimFrequency = 'HIGH';
          patterns.suspiciousIndicators.push({
            type: 'HIGH_CLAIM_FREQUENCY',
            details: `${recentClaims.length} claims in last 90 days`,
            riskContribution: 30
          });
        }

        // Analyze claim amounts
        const amounts = farmerData.claimHistory.map(claim => claim.amount);
        const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        const currentAmount = transactionData?.amount || 0;

        if (currentAmount > avgAmount * 3) {
          patterns.amountPatterns = 'SUSPICIOUS';
          patterns.suspiciousIndicators.push({
            type: 'UNUSUAL_AMOUNT',
            details: `Claim amount ${currentAmount} is 3x higher than average ${avgAmount}`,
            riskContribution: 25
          });
        }

        // Analyze timing patterns
        const claimTimes = farmerData.claimHistory.map(claim => new Date(claim.date).getHours());
        const nightClaims = claimTimes.filter(hour => hour < 6 || hour > 22).length;
        
        if (nightClaims > farmerData.claimHistory.length * 0.5) {
          patterns.timingPatterns = 'SUSPICIOUS';
          patterns.suspiciousIndicators.push({
            type: 'UNUSUAL_TIMING',
            details: 'High percentage of claims submitted during night hours',
            riskContribution: 15
          });
        }
      }

      return patterns;
    } catch (error) {
      console.error(`❌ ${this.name}: Behavior analysis failed:`, error);
      patterns.suspiciousIndicators.push({
        type: 'ANALYSIS_ERROR',
        details: 'Behavioral analysis failed',
        riskContribution: 20
      });
      return patterns;
    }
  }

  async performAIRiskAssessment(farmerData, networkAnalysis, behaviorAnalysis) {
    console.log(`🤖 ${this.name}: Performing AI risk assessment...`);
    
    const prompt = `
You are an AI fraud detection specialist for agricultural insurance in Sub-Saharan Africa.

Analyze this farmer profile for fraud risk:

FARMER PROFILE:
- ID: ${farmerData.farmerId}
- Name: ${farmerData.name}
- Registration Date: ${farmerData.registrationDate}
- Farm Size: ${farmerData.farmSize} hectares
- Crop Types: ${farmerData.cropTypes?.join(', ') || 'Unknown'}
- Previous Claims: ${farmerData.claimHistory?.length || 0}
- Success Rate: ${farmerData.successRate || 100}%

NETWORK ANALYSIS:
- SIM Swap Risk: ${networkAnalysis.simSwapRisk}%
- Location Consistency: ${networkAnalysis.locationConsistency}%
- Network Anomalies: ${networkAnalysis.networkAnomalies.length}

BEHAVIOR ANALYSIS:
- Claim Frequency: ${behaviorAnalysis.claimFrequency}
- Amount Patterns: ${behaviorAnalysis.amountPatterns}
- Timing Patterns: ${behaviorAnalysis.timingPatterns}
- Suspicious Indicators: ${behaviorAnalysis.suspiciousIndicators.length}

Provide a JSON response with:
1. overallRiskScore (0-100)
2. fraudProbability (0-100)
3. riskCategory ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
4. primaryRiskFactors (array of top 3 risk factors)
5. recommendedActions (array of suggested actions)
6. confidenceLevel (0-100)
7. reasoning (detailed explanation)

Consider SSA-specific factors:
- Seasonal farming patterns
- Rural connectivity challenges
- Mobile money usage patterns
- Regional fraud trends
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 800
      });

      const assessment = JSON.parse(response.choices[0].message.content);
      console.log(`🤖 ${this.name}: AI assessment complete - Risk Score: ${assessment.overallRiskScore}`);
      
      return assessment;
    } catch (error) {
      console.error(`❌ ${this.name}: AI risk assessment failed:`, error);
      return {
        overallRiskScore: 75,
        fraudProbability: 75,
        riskCategory: 'HIGH',
        primaryRiskFactors: ['AI analysis failed'],
        recommendedActions: ['Manual review required'],
        confidenceLevel: 0,
        reasoning: 'AI assessment failed - defaulting to high risk'
      };
    }
  }

  async generateFraudReport(farmerData, networkAnalysis, behaviorAnalysis, aiAssessment) {
    console.log(`📊 ${this.name}: Generating comprehensive fraud report...`);
    
    // Calculate composite risk score
    const networkRisk = Math.max(networkAnalysis.simSwapRisk, 100 - networkAnalysis.locationConsistency);
    const behaviorRisk = behaviorAnalysis.suspiciousIndicators.reduce((sum, indicator) => 
      sum + indicator.riskContribution, 0);
    const aiRisk = aiAssessment.overallRiskScore;
    
    const compositeRiskScore = Math.round((networkRisk * 0.4 + behaviorRisk * 0.3 + aiRisk * 0.3));
    
    // Determine risk level
    let riskLevel = 'LOW';
    if (compositeRiskScore >= this.riskThresholds.CRITICAL) riskLevel = 'CRITICAL';
    else if (compositeRiskScore >= this.riskThresholds.HIGH) riskLevel = 'HIGH';
    else if (compositeRiskScore >= this.riskThresholds.MEDIUM) riskLevel = 'MEDIUM';
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(riskLevel, networkAnalysis, behaviorAnalysis, aiAssessment);
    
    const report = {
      farmerId: farmerData.farmerId,
      riskLevel,
      riskScore: compositeRiskScore,
      confidence: aiAssessment.confidenceLevel,
      analysis: {
        network: networkAnalysis,
        behavior: behaviorAnalysis,
        ai: aiAssessment
      },
      recommendations,
      alerts: this.generateAlerts(riskLevel, networkAnalysis, behaviorAnalysis),
      timestamp: new Date().toISOString(),
      agent: this.name,
      version: this.version
    };

    // Store suspicious patterns for future reference
    if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
      this.suspiciousPatterns.set(farmerData.farmerId, {
        riskScore: compositeRiskScore,
        patterns: [...networkAnalysis.networkAnomalies, ...behaviorAnalysis.suspiciousIndicators],
        timestamp: new Date().toISOString()
      });
    }

    return report;
  }

  generateRecommendations(riskLevel, networkAnalysis, behaviorAnalysis, aiAssessment) {
    const recommendations = [];

    switch (riskLevel) {
      case 'CRITICAL':
        recommendations.push('BLOCK_TRANSACTION', 'IMMEDIATE_INVESTIGATION', 'CONTACT_FARMER');
        break;
      case 'HIGH':
        recommendations.push('MANUAL_REVIEW', 'ADDITIONAL_VERIFICATION', 'MONITOR_CLOSELY');
        break;
      case 'MEDIUM':
        recommendations.push('ENHANCED_MONITORING', 'VERIFY_IDENTITY');
        break;
      case 'LOW':
        recommendations.push('STANDARD_PROCESSING');
        break;
    }

    // Add specific recommendations based on analysis
    if (networkAnalysis.simSwapRisk > 50) {
      recommendations.push('VERIFY_SIM_OWNERSHIP');
    }
    
    if (networkAnalysis.locationConsistency < 70) {
      recommendations.push('VERIFY_LOCATION');
    }

    if (behaviorAnalysis.claimFrequency === 'HIGH') {
      recommendations.push('REVIEW_CLAIM_HISTORY');
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  generateAlerts(riskLevel, networkAnalysis, behaviorAnalysis) {
    const alerts = [];

    if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
      alerts.push({
        type: 'FRAUD_RISK',
        severity: riskLevel,
        message: `High fraud risk detected - ${riskLevel} level`,
        timestamp: new Date().toISOString()
      });
    }

    networkAnalysis.networkAnomalies.forEach(anomaly => {
      if (anomaly.severity === 'HIGH') {
        alerts.push({
          type: 'NETWORK_ANOMALY',
          severity: anomaly.severity,
          message: anomaly.details,
          timestamp: new Date().toISOString()
        });
      }
    });

    return alerts;
  }

  // Real-time fraud monitoring
  async startRealTimeMonitoring(farmerId, callback) {
    console.log(`👁️ ${this.name}: Starting real-time monitoring for farmer ${farmerId}`);
    
    const monitoringInterval = setInterval(async () => {
      try {
        if (this.suspiciousPatterns.has(farmerId)) {
          const pattern = this.suspiciousPatterns.get(farmerId);
          
          // Check if risk level has changed
          const update = {
            farmerId,
            type: 'RISK_UPDATE',
            currentRisk: pattern.riskScore,
            timestamp: new Date().toISOString(),
            agent: this.name
          };
          
          callback(update);
        }
      } catch (error) {
        console.error(`❌ ${this.name}: Monitoring error:`, error);
      }
    }, 60000); // Check every minute

    return monitoringInterval;
  }

  stopMonitoring(monitoringInterval) {
    clearInterval(monitoringInterval);
    console.log(`⏹️ ${this.name}: Monitoring stopped`);
  }
}

module.exports = FraudDetectionAgent;