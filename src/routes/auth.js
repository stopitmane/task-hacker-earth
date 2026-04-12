const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const logger = require('../utils/logger');
const { authService, authenticateJWT } = require('../middleware/auth');
const { authRateLimit } = require('../middleware/rateLimiting');
const { validationSchemas, handleValidationErrors, securityAuditLogger } = require('../middleware/security');

// Apply security middleware to all auth routes
router.use(securityAuditLogger);
router.use(authRateLimit);

// User login
router.post('/login', validationSchemas.userAuth, handleValidationErrors, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    logger.audit('Login attempt', { 
      email, 
      ip: req.ip, 
      userAgent: req.get('User-Agent') 
    });
    
    const result = await authService.authenticate(email, password);
    
    if (!result.success) {
      logger.security('Failed login attempt', { 
        email, 
        ip: req.ip, 
        error: result.error 
      });
      
      return res.status(401).json({
        error: 'Authentication failed',
        message: result.error
      });
    }
    
    logger.audit('Successful login', { 
      userId: result.user.id, 
      email: result.user.email, 
      role: result.user.role,
      ip: req.ip 
    });
    
    res.json({
      message: 'Login successful',
      user: result.user,
      tokens: result.tokens,
      loginTime: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: 'An internal error occurred'
    });
  }
});

// Refresh access token
router.post('/refresh', [
  body('refreshToken').notEmpty().withMessage('Refresh token is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    const result = await authService.refreshAccessToken(refreshToken);
    
    if (!result.success) {
      logger.security('Failed token refresh', { 
        ip: req.ip, 
        error: result.error 
      });
      
      return res.status(401).json({
        error: 'Token refresh failed',
        message: result.error
      });
    }
    
    logger.audit('Token refreshed successfully', { ip: req.ip });
    
    res.json({
      message: 'Token refreshed successfully',
      tokens: result.tokens,
      refreshTime: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Token refresh failed',
      message: 'An internal error occurred'
    });
  }
});

// User logout
router.post('/logout', authenticateJWT, [
  body('refreshToken').notEmpty().withMessage('Refresh token is required')
], handleValidationErrors, (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    const result = authService.logout(refreshToken);
    
    logger.audit('User logout', { 
      userId: req.user.id, 
      email: req.user.email,
      ip: req.ip 
    });
    
    res.json({
      message: 'Logout successful',
      logoutTime: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout failed',
      message: 'An internal error occurred'
    });
  }
});

// Get current user profile
router.get('/profile', authenticateJWT, (req, res) => {
  try {
    logger.audit('Profile access', { 
      userId: req.user.id, 
      email: req.user.email,
      ip: req.ip 
    });
    
    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
        iat: req.user.iat
      },
      accessTime: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Profile access error:', error);
    res.status(500).json({
      error: 'Profile access failed',
      message: 'An internal error occurred'
    });
  }
});

// Change password
router.post('/change-password', authenticateJWT, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one lowercase letter, one uppercase letter, and one number')
], handleValidationErrors, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // In a real implementation, you would:
    // 1. Verify current password
    // 2. Hash new password
    // 3. Update in database
    // 4. Invalidate all existing tokens
    
    logger.audit('Password change request', { 
      userId: req.user.id, 
      email: req.user.email,
      ip: req.ip 
    });
    
    res.json({
      message: 'Password change functionality not implemented in demo',
      note: 'In production, this would update the password and invalidate all tokens'
    });
    
  } catch (error) {
    logger.error('Password change error:', error);
    res.status(500).json({
      error: 'Password change failed',
      message: 'An internal error occurred'
    });
  }
});

// Get authentication statistics (admin only)
router.get('/stats', authenticateJWT, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Admin role required'
      });
    }
    
    const stats = authService.getUserStats();
    
    logger.audit('Auth stats accessed', { 
      adminId: req.user.id,
      ip: req.ip 
    });
    
    res.json({
      message: 'Authentication statistics',
      stats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Auth stats error:', error);
    res.status(500).json({
      error: 'Stats access failed',
      message: 'An internal error occurred'
    });
  }
});

// Demo users endpoint (for testing)
router.get('/demo-users', (req, res) => {
  res.json({
    message: 'Demo users for testing',
    users: [
      {
        email: 'farmer@agriguard.com',
        password: 'farmer123',
        role: 'farmer',
        description: 'Demo farmer account'
      },
      {
        email: 'admin@agriguard.com',
        password: 'admin123',
        role: 'admin',
        description: 'Demo admin account'
      },
      {
        email: 'api@partner.com',
        password: 'partner123',
        role: 'api_client',
        description: 'Demo API client account'
      }
    ],
    apiKeys: [
      {
        key: 'ak_demo_nokia_integration',
        name: 'Nokia Integration Demo',
        role: 'nokia_partner',
        usage: 'Add to x-api-key header for CAMARA API access'
      }
    ],
    note: 'These are demo credentials for testing purposes only'
  });
});

module.exports = router;