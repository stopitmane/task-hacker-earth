const express = require('express');
const router = express.Router();

// Get AI agent status
router.get('/status', (req, res) => {
  try {
    const agentStatus = {
      claimAssessmentAgent: {
        name: 'ClaimAssessmentAgent',
        version: '1.0.0',
        status: req.agents?.claimAgent ? 'active' : 'inactive',
        capabilities: [
          'Automated claim assessment',
          'Network intelligence gathering',
          'AI-powered risk analysis',
          'Real-time decision making'
        ]
      },
      fraudDetectionAgent: {
        name: 'FraudDetecti