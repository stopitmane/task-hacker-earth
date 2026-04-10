const OpenAI = require('openai');
const CamaraService = require('../services/CamaraService');

class ClaimAssessmentAgent {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.name = 'ClaimAssessmentAgent';
    this.version = '1.0.0';
  }

  async assessClaim(claimData) {
    console.log(`🤖 ${this.name}: Starting claim assessment for claim ${claimData.claimId}`);
    
    try {
      // Step 1: Gather network intelligence
      const networkIntelligence = await this.gatherNetworkIntelligence(claimData);
      
      // Step 2: Analyze claim using AI
      const aiAnalysis = await this.performAIAnalysis(claimData, networkIntelligence);
      
      // Step 3: Make decision
      const decision = await this.makeDecision(claimData, networkIntelligence, aiAnalysis);
      
      console.log(`✅ ${this.name}: Assessment complete - Decision: ${decision.approved ? 'APPROVED' : 'REJECTED'}`);
      
      return {
        claimId: claimData.claimId,
        assessment: {
          approved: decision.approved,
          confidence: decision.confidence,
          payoutAmount: decision.payoutAmount,
          reasoning: decision.reasoning,
          riskFactors: decision.riskFactors,
          networkIntelligence,
          aiAnalysis,
          timestamp: new Date().toISOString(),
          agent: this.name
        }
      };
    } catch (error) {
      console.error(`❌ ${this.name}: Assessment failed:`, error);
      return {
        claimId: claimData.claimId,
        assessment: {
          approved: false,
          confidence: 0,
          reasoning: 'Assessment failed due to technical error',
          error: error.message,
          timestamp: new Date().toISOString(),
          agent: this.name
        }
      };
    }
  }

  async gatherNetworkIntelligence(claimData) {
    console.log(`🔍 ${this.name}: Gathering network intelligence...`);
    
    const intelligence = {
      locationVerification: null,
      simSwapCheck: null,
      deviceStatus: null,
      connectivityQuality: null
    };

    try {
      // Verify farmer is at claimed location
      if (claimData.farmer.phoneNumber && claimData.cropLocation) {
        intelligence.locationVerification = await CamaraService.verifyLocation(
          claimData.farmer.phoneNumber,
          claimData.cropLocation
        );
      }

      // Check for recent SIM swap (fraud indicator)
      if (claimData.farmer.phoneNumber) {
        intelligence.simSwapCheck = await CamaraService.checkSimSwap(
          claimData.farmer.phoneNumber,
          720 // 12 hours
        );
      }

      // Get device connectivity status
      if (claimData.farmer.phoneNumber) {
        intelligence.deviceStatus = await CamaraService.getDeviceStatus(
          claimData.farmer.phoneNumber
        );
      }

      return intelligence;
    } catch (error) {
      console.error(`❌ ${this.name}: Network intelligence gathering failed:`, error);
      return intelligence;
    }
  }

  async performAIAnalysis(claimData, networkIntelligence) {
    console.log(`🧠 ${this.name}: Performing AI analysis...`);
    
    const prompt = `
You are an AI agent specializing in agricultural insurance claim assessment for Sub-Saharan Africa. 

Analyze this crop insurance claim:

CLAIM DETAILS:
- Claim ID: ${claimData.claimId}
- Farmer: ${claimData.farmer.name}
- Crop Type: ${claimData.cropType}
- Claimed Loss: ${claimData.claimedLoss}%
- Claim Amount: $${claimData.claimAmount}
- Incident Date: ${claimData.incidentDate}
- Reason: ${claimData.reason}
- Farm Size: ${claimData.farmSize} hectares
- Location: ${claimData.cropLocation?.latitude}, ${claimData.cropLocation?.longitude}

NETWORK INTELLIGENCE:
- Location Verified: ${networkIntelligence.locationVerification?.verified || 'Unknown'}
- Location Confidence: ${networkIntelligence.locationVerification?.confidence || 0}%
- Recent SIM Swap: ${networkIntelligence.simSwapCheck?.swapped || 'Unknown'}
- Device Status: ${networkIntelligence.deviceStatus?.connectivity || 'Unknown'}
- Risk Level: ${networkIntelligence.simSwapCheck?.riskLevel || 'Unknown'}

FARMER HISTORY:
- Previous Claims: ${claimData.farmer.previousClaims || 0}
- Success Rate: ${claimData.farmer.successRate || 100}%
- Registration Date: ${claimData.farmer.registrationDate}

Provide a JSON response with:
1. riskScore (0-100, where 100 is highest risk)
2. fraudProbability (0-100)
3. recommendedAction ('APPROVE', 'REJECT', 'INVESTIGATE')
4. payoutPercentage (0-100)
5. keyFactors (array of important decision factors)
6. reasoning (detailed explanation)

Consider factors like:
- Network-based location verification
- SIM swap fraud indicators
- Historical claim patterns
- Crop type and seasonal factors
- Geographic risk factors for SSA agriculture
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1000
      });

      const analysis = JSON.parse(response.choices[0].message.content);
      console.log(`🧠 ${this.name}: AI analysis complete - Risk Score: ${analysis.riskScore}`);
      
      return analysis;
    } catch (error) {
      console.error(`❌ ${this.name}: AI analysis failed:`, error);
      return {
        riskScore: 50,
        fraudProbability: 50,
        recommendedAction: 'INVESTIGATE',
        payoutPercentage: 0,
        keyFactors: ['AI analysis failed'],
        reasoning: 'Unable to complete AI analysis due to technical error'
      };
    }
  }

  async makeDecision(claimData, networkIntelligence, aiAnalysis) {
    console.log(`⚖️ ${this.name}: Making final decision...`);
    
    let approved = false;
    let confidence = 0;
    let payoutAmount = 0;
    const riskFactors = [];

    // Decision logic based on network intelligence and AI analysis
    if (networkIntelligence.simSwapCheck?.swapped) {
      riskFactors.push('Recent SIM swap detected - high fraud risk');
    }

    if (!networkIntelligence.locationVerification?.verified) {
      riskFactors.push('Location verification failed');
    }

    if (aiAnalysis.fraudProbability > 70) {
      riskFactors.push('High fraud probability from AI analysis');
    }

    // Approval criteria
    const locationVerified = networkIntelligence.locationVerification?.verified || false;
    const noRecentSimSwap = !networkIntelligence.simSwapCheck?.swapped;
    const lowFraudRisk = aiAnalysis.fraudProbability < 30;
    const aiRecommendation = aiAnalysis.recommendedAction === 'APPROVE';

    if (locationVerified && noRecentSimSwap && lowFraudRisk && aiRecommendation) {
      approved = true;
      confidence = Math.min(95, 
        (networkIntelligence.locationVerification.confidence + 
         (100 - aiAnalysis.fraudProbability) + 
         (100 - aiAnalysis.riskScore)) / 3
      );
      payoutAmount = (claimData.claimAmount * aiAnalysis.payoutPercentage) / 100;
    } else if (aiAnalysis.recommendedAction === 'INVESTIGATE') {
      approved = false;
      confidence = 60;
      riskFactors.push('Requires manual investigation');
    } else {
      approved = false;
      confidence = 80;
    }

    return {
      approved,
      confidence: Math.round(confidence),
      payoutAmount: Math.round(payoutAmount * 100) / 100,
      reasoning: aiAnalysis.reasoning,
      riskFactors,
      networkFactors: {
        locationVerified,
        simSwapRisk: networkIntelligence.simSwapCheck?.riskLevel || 'UNKNOWN',
        deviceConnectivity: networkIntelligence.deviceStatus?.connectivity || 'UNKNOWN'
      }
    };
  }

  // Real-time monitoring for claim status updates
  async monitorClaim(claimId, callback) {
    console.log(`👁️ ${this.name}: Starting monitoring for claim ${claimId}`);
    
    // This would typically integrate with external data sources
    // For demo purposes, we'll simulate monitoring
    const monitoringInterval = setInterval(async () => {
      try {
        // Simulate checking external conditions
        const update = {
          claimId,
          timestamp: new Date().toISOString(),
          status: 'MONITORING',
          agent: this.name
        };
        
        callback(update);
      } catch (error) {
        console.error(`❌ ${this.name}: Monitoring error:`, error);
        clearInterval(monitoringInterval);
      }
    }, 30000); // Check every 30 seconds

    // Stop monitoring after 1 hour
    setTimeout(() => {
      clearInterval(monitoringInterval);
      console.log(`⏰ ${this.name}: Monitoring stopped for claim ${claimId}`);
    }, 3600000);
  }
}

module.exports = ClaimAssessmentAgent;