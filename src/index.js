const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const cron = require('node-cron');
const morgan = require('morgan');

// Load environment variables
dotenv.config();

// Import modules
const logger = require('./utils/logger');
const camaraService = require('./services/camaraService');
const processingEngine = require('./services/processingEngine');

// Import routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const insuranceRoutes = require('./routes/insurance');
const farmerRoutes = require('./routes/farmer');

// Import security middleware
const { 
  securityHeaders, 
  sanitizeInput, 
  securityAuditLogger,
  ipFilter,
  requestSizeLimiter,
  customSecurityHeaders
} = require('./middleware/security');

const { 
  generalRateLimit, 
  speedLimiter, 
  burstProtection,
  rateLimitLogger
} = require('./middleware/rateLimiting');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (important for rate limiting and IP detection)
app.set('trust proxy', 1);

// Security middleware (applied first)
app.use(securityHeaders);
app.use(ipFilter);
app.use(requestSizeLimiter);
app.use(customSecurityHeaders);

// Request logging
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim(), { category: 'http' })
  }
}));

// Rate limiting and speed control
app.use(generalRateLimit);
app.use(speedLimiter);
app.use(burstProtection);
app.use(rateLimitLogger);

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-request-id']
}));

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization
app.use(sanitizeInput);

// Security audit logging
app.use(securityAuditLogger);

// API Routes
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/api/insurance', insuranceRoutes);
app.use('/api/farmer', farmerRoutes);

// Health check endpoint (no authentication required)
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'AgriGuard Insurance Platform',
    version: '1.0.0',
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  };
  
  logger.info('Health check accessed', { ip: req.ip });
  res.json(health);
});

// Root endpoint with API information
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to AgriGuard - Secure Agricultural Insurance Platform',
    version: '1.0.0',
    apis: ['Location', 'SIM Swap', 'Device Status'],
    features: [
      'JWT Authentication',
      'Rate Limiting', 
      'Security Headers',
      'Input Validation',
      'Audit Logging',
      'Smart Automation',
      'Fraud Detection',
      'Location Verification',
      'Automated Payouts'
    ],
    security: {
      authentication: 'JWT + API Keys',
      rateLimiting: 'Multi-tier protection',
      logging: 'Comprehensive audit trail',
      validation: 'Input sanitization & validation'
    },
    endpoints: {
      auth: '/auth (login, refresh, profile)',
      admin: '/admin (system management)',
      insurance: '/api/insurance (policies, claims)',
      farmer: '/api/farmer (registration, profile)',
      health: '/health (system status)'
    },
    documentation: 'See /auth/demo-users for test credentials'
  });
});

// Security endpoint for monitoring
app.get('/security/status', (req, res) => {
  res.json({
    securityFeatures: {
      helmet: true,
      rateLimiting: true,
      inputValidation: true,
      auditLogging: true,
      authentication: true,
      authorization: true,
      ipFiltering: true,
      requestSizeLimit: true
    },
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  res.status(404).json({
    error: 'Route not found',
    message: `The requested endpoint ${req.method} ${req.originalUrl} does not exist`,
    availableEndpoints: [
      'GET /',
      'GET /health',
      'GET /security/status',
      'POST /auth/login',
      'GET /auth/demo-users',
      'GET /admin/system/health',
      'POST /api/insurance/policy',
      'POST /api/farmer/register'
    ]
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    error: 'Internal server error',
    message: isDevelopment ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id'] || 'unknown'
  });
});

// Scheduled tasks - System monitoring
cron.schedule('*/15 * * * *', async () => {
  logger.info('Running scheduled system monitoring...');
  try {
    await processingEngine.monitorActivePolicies();
    
    // Log system health metrics
    const memUsage = process.memoryUsage();
    logger.performance('System metrics', {
      uptime: process.uptime(),
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB'
      }
    });
    
  } catch (error) {
    logger.error('Scheduled monitoring failed:', error);
  }
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
const server = app.listen(PORT, () => {
  logger.info(`🚀 AgriGuard server running on port ${PORT}`);
  logger.info('🔒 Security features: Authentication, Rate Limiting, Input Validation, Audit Logging');
  logger.info('📡 CAMARA APIs: Location, SIM Swap, Device Status');
  logger.info('🔧 Smart automation: Active monitoring enabled');
  logger.info('🌍 Environment:', process.env.NODE_ENV || 'development');
});

// Handle server errors
server.on('error', (error) => {
  logger.error('Server error:', error);
});

module.exports = app;