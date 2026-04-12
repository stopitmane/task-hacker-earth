const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { authenticateJWT, authorize } = require('../middleware/auth');
const { getRateLimitStats } = require('../middleware/rateLimiting');
const { getSecurityStats } = require('../middleware/security');

// All admin routes require authentication and admin role
router.use(authenticateJWT);
router.use(authorize('admin'));

// System health and statistics
router.get('/system/health', (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version,
      platform: process.platform,
      environment: process.env.NODE_ENV || 'development'
    };
    
    logger.audit('System health check accessed', { 
      adminId: req.user.id,
      ip: req.ip 
    });
    
    res.json(health);
  } catch (error) {
    logger.error('System health check error:', error);
    res.status(500).json({
      error: 'Health check failed',
      message: error.message
    });
  }
});

// Security statistics
router.get('/security/stats', (req, res) => {
  try {
    const securityStats = getSecurityStats();
    const rateLimitStats = getRateLimitStats();
    const logStats = logger.getStats();
    
    const stats = {
      security: securityStats,
      rateLimiting: rateLimitStats,
      logging: logStats,
      timestamp: new Date().toISOString()
    };
    
    logger.audit('Security stats accessed', { 
      adminId: req.user.id,
      ip: req.ip 
    });
    
    res.json(stats);
  } catch (error) {
    logger.error('Security stats error:', error);
    res.status(500).json({
      error: 'Security stats failed',
      message: error.message
    });
  }
});

// API usage statistics
router.get('/api/usage', (req, res) => {
  try {
    // In production, this would come from a database or analytics service
    const usage = {
      totalRequests: 1250,
      requestsByEndpoint: {
        '/api/insurance/claim': 450,
        '/api/insurance/policy': 320,
        '/api/farmer/register': 280,
        '/api/insurance/verify-location': 200
      },
      requestsByUser: {
        'farmer-001': 680,
        'admin-001': 120,
        'api-client-001': 450
      },
      errorRates: {
        '4xx': 0.05, // 5%
        '5xx': 0.01  // 1%
      },
      averageResponseTime: 245, // ms
      peakHour: '14:00-15:00',
      timestamp: new Date().toISOString()
    };
    
    logger.audit('API usage stats accessed', { 
      adminId: req.user.id,
      ip: req.ip 
    });
    
    res.json(usage);
  } catch (error) {
    logger.error('API usage stats error:', error);
    res.status(500).json({
      error: 'API usage stats failed',
      message: error.message
    });
  }
});

// CAMARA API monitoring
router.get('/camara/status', (req, res) => {
  try {
    // In production, this would check actual CAMARA API status
    const camaraStatus = {
      locationAPI: {
        status: 'operational',
        responseTime: 180,
        successRate: 0.98,
        lastCheck: new Date().toISOString()
      },
      simSwapAPI: {
        status: 'operational',
        responseTime: 220,
        successRate: 0.97,
        lastCheck: new Date().toISOString()
      },
      deviceStatusAPI: {
        status: 'operational',
        responseTime: 160,
        successRate: 0.99,
        lastCheck: new Date().toISOString()
      },
      overallHealth: 'good',
      timestamp: new Date().toISOString()
    };
    
    logger.audit('CAMARA status accessed', { 
      adminId: req.user.id,
      ip: req.ip 
    });
    
    res.json(camaraStatus);
  } catch (error) {
    logger.error('CAMARA status error:', error);
    res.status(500).json({
      error: 'CAMARA status failed',
      message: error.message
    });
  }
});

// User management
router.get('/users', (req, res) => {
  try {
    // In production, this would come from a database
    const users = [
      {
        id: 'farmer-001',
        email: 'farmer@agriguard.com',
        role: 'farmer',
        status: 'active',
        lastLogin: '2026-04-12T10:30:00Z',
        createdAt: '2026-04-01T09:00:00Z'
      },
      {
        id: 'admin-001',
        email: 'admin@agriguard.com',
        role: 'admin',
        status: 'active',
        lastLogin: '2026-04-12T16:45:00Z',
        createdAt: '2026-04-01T09:00:00Z'
      }
    ];
    
    logger.audit('User list accessed', { 
      adminId: req.user.id,
      ip: req.ip 
    });
    
    res.json({
      users,
      total: users.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('User list error:', error);
    res.status(500).json({
      error: 'User list failed',
      message: error.message
    });
  }
});

// Policy management
router.get('/policies', (req, res) => {
  try {
    // In production, this would come from a database
    const policies = [
      {
        id: 'POL-001',
        farmerId: 'farmer-001',
        status: 'active',
        coverageAmount: 50000,
        coverageType: ['drought', 'flood'],
        createdAt: '2026-04-10T12:00:00Z',
        lastClaim: null
      }
    ];
    
    logger.audit('Policy list accessed', { 
      adminId: req.user.id,
      ip: req.ip 
    });
    
    res.json({
      policies,
      total: policies.length,
      totalCoverage: policies.reduce((sum, p) => sum + p.coverageAmount, 0),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Policy list error:', error);
    res.status(500).json({
      error: 'Policy list failed',
      message: error.message
    });
  }
});

// Claims management
router.get('/claims', (req, res) => {
  try {
    // In production, this would come from a database
    const claims = [
      {
        id: 'AG-1776012761632-drought123',
        farmerId: 'farmer-001',
        type: 'drought',
        status: 'approved',
        amount: 42000,
        confidence: 87,
        processedAt: '2026-04-12T14:30:00Z',
        paidAt: '2026-04-12T14:31:00Z'
      }
    ];
    
    logger.audit('Claims list accessed', { 
      adminId: req.user.id,
      ip: req.ip 
    });
    
    res.json({
      claims,
      total: claims.length,
      totalPaid: claims.reduce((sum, c) => sum + (c.status === 'approved' ? c.amount : 0), 0),
      approvalRate: claims.filter(c => c.status === 'approved').length / claims.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Claims list error:', error);
    res.status(500).json({
      error: 'Claims list failed',
      message: error.message
    });
  }
});

// System configuration
router.get('/config', (req, res) => {
  try {
    const config = {
      rateLimits: {
        general: '100 requests per 15 minutes',
        auth: '5 requests per 15 minutes',
        camara: '10 requests per minute',
        claims: '3 requests per 5 minutes'
      },
      security: {
        jwtExpiry: '24 hours',
        refreshTokenExpiry: '7 days',
        passwordPolicy: 'Min 6 chars, mixed case, numbers',
        encryptionAlgorithm: 'bcrypt'
      },
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        retention: '30 days',
        maxFileSize: '5MB'
      },
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    };
    
    logger.audit('System config accessed', { 
      adminId: req.user.id,
      ip: req.ip 
    });
    
    res.json(config);
  } catch (error) {
    logger.error('System config error:', error);
    res.status(500).json({
      error: 'System config failed',
      message: error.message
    });
  }
});

// Emergency shutdown (for maintenance)
router.post('/emergency/shutdown', (req, res) => {
  try {
    logger.security('Emergency shutdown initiated', { 
      adminId: req.user.id,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      message: 'Emergency shutdown initiated',
      note: 'In production, this would gracefully shut down the server',
      timestamp: new Date().toISOString()
    });
    
    // In production, you would:
    // setTimeout(() => process.exit(0), 5000);
    
  } catch (error) {
    logger.error('Emergency shutdown error:', error);
    res.status(500).json({
      error: 'Emergency shutdown failed',
      message: error.message
    });
  }
});

module.exports = router;