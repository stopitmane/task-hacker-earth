const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class AuthService {
  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET || 'agriguard-super-secret-key-2026';
    this.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
    this.REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
    
    // In-memory storage for demo (use database in production)
    this.users = new Map();
    this.refreshTokens = new Map();
    this.apiKeys = new Map();
    
    // Initialize with demo users
    this.initializeDemoUsers();
  }

  async initializeDemoUsers() {
    // Create demo users for different roles
    const demoUsers = [
      {
        id: 'farmer-001',
        email: 'farmer@agriguard.com',
        password: 'farmer123',
        role: 'farmer',
        phoneNumber: '+254700123456',
        name: 'John Mwangi'
      },
      {
        id: 'admin-001',
        email: 'admin@agriguard.com',
        password: 'admin123',
        role: 'admin',
        name: 'Admin User'
      },
      {
        id: 'api-client-001',
        email: 'api@partner.com',
        password: 'partner123',
        role: 'api_client',
        name: 'Partner API Client'
      }
    ];

    for (const user of demoUsers) {
      const hashedPassword = await bcrypt.hash(user.password, 12);
      this.users.set(user.email, {
        ...user,
        password: hashedPassword,
        createdAt: new Date().toISOString(),
        lastLogin: null,
        isActive: true
      });
    }

    // Create API keys for external integrations
    this.apiKeys.set('ak_demo_nokia_integration', {
      id: 'ak_demo_nokia_integration',
      name: 'Nokia Integration Demo',
      role: 'nokia_partner',
      permissions: ['camara:location', 'camara:sim-swap', 'camara:device-status'],
      createdAt: new Date().toISOString(),
      lastUsed: null,
      isActive: true
    });

    logger.info('Demo users and API keys initialized');
  }

  // Generate JWT tokens
  generateTokens(user) {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      iat: Math.floor(Date.now() / 1000)
    };

    const accessToken = jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES_IN,
      issuer: 'agriguard-platform',
      audience: 'agriguard-users'
    });

    const refreshToken = jwt.sign(
      { id: user.id, type: 'refresh' },
      this.JWT_SECRET,
      { expiresIn: this.REFRESH_TOKEN_EXPIRES_IN }
    );

    // Store refresh token
    this.refreshTokens.set(refreshToken, {
      userId: user.id,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });

    return { accessToken, refreshToken };
  }

  // Authenticate user with email/password
  async authenticate(email, password) {
    try {
      const user = this.users.get(email);
      if (!user || !user.isActive) {
        logger.warn(`Authentication failed for ${email}: User not found or inactive`);
        return { success: false, error: 'Invalid credentials' };
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        logger.warn(`Authentication failed for ${email}: Invalid password`);
        return { success: false, error: 'Invalid credentials' };
      }

      // Update last login
      user.lastLogin = new Date().toISOString();
      this.users.set(email, user);

      const tokens = this.generateTokens(user);
      
      logger.info(`User authenticated successfully: ${email} (${user.role})`);
      
      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name,
          phoneNumber: user.phoneNumber
        },
        tokens
      };
    } catch (error) {
      logger.error('Authentication error:', error);
      return { success: false, error: 'Authentication failed' };
    }
  }

  // Verify JWT token
  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET, {
        issuer: 'agriguard-platform',
        audience: 'agriguard-users'
      });
      
      const user = Array.from(this.users.values()).find(u => u.id === decoded.id);
      if (!user || !user.isActive) {
        return { valid: false, error: 'User not found or inactive' };
      }

      return { valid: true, user: decoded };
    } catch (error) {
      logger.warn('Token verification failed:', error.message);
      return { valid: false, error: error.message };
    }
  }

  // Verify API key
  verifyApiKey(apiKey) {
    const keyData = this.apiKeys.get(apiKey);
    if (!keyData || !keyData.isActive) {
      return { valid: false, error: 'Invalid or inactive API key' };
    }

    // Update last used
    keyData.lastUsed = new Date().toISOString();
    this.apiKeys.set(apiKey, keyData);

    return { valid: true, keyData };
  }

  // Refresh access token
  async refreshAccessToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, this.JWT_SECRET);
      const tokenData = this.refreshTokens.get(refreshToken);
      
      if (!tokenData || decoded.id !== tokenData.userId) {
        return { success: false, error: 'Invalid refresh token' };
      }

      const user = Array.from(this.users.values()).find(u => u.id === decoded.id);
      if (!user || !user.isActive) {
        return { success: false, error: 'User not found or inactive' };
      }

      const tokens = this.generateTokens(user);
      
      // Remove old refresh token
      this.refreshTokens.delete(refreshToken);
      
      return { success: true, tokens };
    } catch (error) {
      logger.error('Token refresh error:', error);
      return { success: false, error: 'Token refresh failed' };
    }
  }

  // Logout (invalidate refresh token)
  logout(refreshToken) {
    if (this.refreshTokens.has(refreshToken)) {
      this.refreshTokens.delete(refreshToken);
      return { success: true };
    }
    return { success: false, error: 'Token not found' };
  }

  // Get user statistics
  getUserStats() {
    const users = Array.from(this.users.values());
    const activeUsers = users.filter(u => u.isActive);
    const roleStats = {};
    
    activeUsers.forEach(user => {
      roleStats[user.role] = (roleStats[user.role] || 0) + 1;
    });

    return {
      totalUsers: users.length,
      activeUsers: activeUsers.length,
      roleDistribution: roleStats,
      apiKeys: this.apiKeys.size,
      activeRefreshTokens: this.refreshTokens.size
    };
  }
}

// Middleware functions
const authService = new AuthService();

// JWT Authentication middleware
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    logger.warn(`Authentication required for ${req.method} ${req.path} from ${req.ip}`);
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please provide a valid JWT token'
    });
  }

  const verification = authService.verifyToken(token);
  if (!verification.valid) {
    logger.warn(`Invalid token for ${req.method} ${req.path} from ${req.ip}: ${verification.error}`);
    return res.status(401).json({ 
      error: 'Invalid token',
      message: verification.error
    });
  }

  req.user = verification.user;
  logger.info(`Authenticated user ${req.user.email} for ${req.method} ${req.path}`);
  next();
};

// API Key authentication middleware
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    logger.warn(`API key required for ${req.method} ${req.path} from ${req.ip}`);
    return res.status(401).json({ 
      error: 'API key required',
      message: 'Please provide a valid API key in x-api-key header'
    });
  }

  const verification = authService.verifyApiKey(apiKey);
  if (!verification.valid) {
    logger.warn(`Invalid API key for ${req.method} ${req.path} from ${req.ip}: ${verification.error}`);
    return res.status(401).json({ 
      error: 'Invalid API key',
      message: verification.error
    });
  }

  req.apiKey = verification.keyData;
  logger.info(`Authenticated API key ${req.apiKey.name} for ${req.method} ${req.path}`);
  next();
};

// Role-based authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user && !req.apiKey) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please authenticate first'
      });
    }

    const userRole = req.user?.role || req.apiKey?.role;
    
    if (!roles.includes(userRole)) {
      logger.warn(`Authorization failed for ${userRole} accessing ${req.method} ${req.path}`);
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        message: `Role '${userRole}' not authorized for this resource`
      });
    }

    logger.info(`Authorized ${userRole} for ${req.method} ${req.path}`);
    next();
  };
};

// Permission-based authorization for API keys
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (req.apiKey && req.apiKey.permissions) {
      if (!req.apiKey.permissions.includes(permission)) {
        logger.warn(`Permission denied: ${req.apiKey.name} lacks ${permission} for ${req.method} ${req.path}`);
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          message: `API key lacks required permission: ${permission}`
        });
      }
    }
    next();
  };
};

module.exports = {
  authService,
  authenticateJWT,
  authenticateApiKey,
  authorize,
  requirePermission
};