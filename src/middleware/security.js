const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');

// Enhanced security headers
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://network-as-code.nokia.com"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow for API usage
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Input validation schemas
const validationSchemas = {
  // User registration/login
  userAuth: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number')
  ],

  // Farmer registration
  farmerRegistration: [
    body('name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),
    body('phoneNumber')
      .matches(/^\+[1-9]\d{1,14}$/)
      .withMessage('Valid international phone number is required'),
    body('farmLocation.lat')
      .isFloat({ min: -90, max: 90 })
      .withMessage('Valid latitude is required'),
    body('farmLocation.lon')
      .isFloat({ min: -180, max: 180 })
      .withMessage('Valid longitude is required'),
    body('cropTypes')
      .optional()
      .isArray()
      .withMessage('Crop types must be an array'),
    body('farmSize')
      .optional()
      .isIn(['small', 'medium', 'large'])
      .withMessage('Farm size must be small, medium, or large')
  ],

  // Insurance policy creation
  policyCreation: [
    body('farmerId')
      .trim()
      .isLength({ min: 1 })
      .withMessage('Farmer ID is required'),
    body('phoneNumber')
      .matches(/^\+[1-9]\d{1,14}$/)
      .withMessage('Valid international phone number is required'),
    body('fieldLocation.lat')
      .isFloat({ min: -90, max: 90 })
      .withMessage('Valid latitude is required'),
    body('fieldLocation.lon')
      .isFloat({ min: -180, max: 180 })
      .withMessage('Valid longitude is required'),
    body('coverageAmount')
      .isFloat({ min: 1000, max: 1000000 })
      .withMessage('Coverage amount must be between 1,000 and 1,000,000'),
    body('coverageType')
      .isArray({ min: 1 })
      .withMessage('At least one coverage type is required'),
    body('coverageType.*')
      .isIn(['drought', 'flood', 'connectivity', 'storm', 'pest'])
      .withMessage('Invalid coverage type')
  ],

  // Claim submission
  claimSubmission: [
    body('farmerId')
      .trim()
      .isLength({ min: 1 })
      .withMessage('Farmer ID is required'),
    body('claimType')
      .isIn(['drought', 'flood', 'connectivity', 'storm', 'pest'])
      .withMessage('Valid claim type is required'),
    body('description')
      .trim()
      .isLength({ min: 10, max: 1000 })
      .withMessage('Description must be between 10 and 1000 characters'),
    body('estimatedLoss')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Estimated loss must be a positive number'),
    body('incidentDate')
      .optional()
      .isISO8601()
      .withMessage('Valid ISO 8601 date is required')
  ],

  // Location verification
  locationVerification: [
    body('phoneNumber')
      .matches(/^\+[1-9]\d{1,14}$/)
      .withMessage('Valid international phone number is required'),
    body('expectedLat')
      .isFloat({ min: -90, max: 90 })
      .withMessage('Valid latitude is required'),
    body('expectedLon')
      .isFloat({ min: -180, max: 180 })
      .withMessage('Valid longitude is required'),
    body('radius')
      .optional()
      .isInt({ min: 100, max: 10000 })
      .withMessage('Radius must be between 100 and 10,000 meters')
  ]
};

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorDetails = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }));
    
    logger.warn(`Validation failed for ${req.method} ${req.path}:`, {
      errors: errorDetails,
      clientId: req.user?.id || req.ip
    });
    
    return res.status(400).json({
      error: 'Validation failed',
      message: 'Please check your input data',
      details: errorDetails
    });
  }
  
  next();
};

// Request sanitization middleware
const sanitizeInput = [
  mongoSanitize(), // Remove NoSQL injection attempts
  xss() // Clean user input from malicious HTML
];

// Security audit logging
const securityAuditLogger = (req, res, next) => {
  const securityInfo = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    apiKeyId: req.apiKey?.id,
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length')
  };
  
  // Log sensitive operations
  const sensitiveEndpoints = ['/auth', '/claim', '/policy', '/verify'];
  if (sensitiveEndpoints.some(endpoint => req.path.includes(endpoint))) {
    logger.info('Security audit:', securityInfo);
  }
  
  // Detect suspicious patterns
  const suspiciousPatterns = [
    /script/i,
    /javascript/i,
    /vbscript/i,
    /onload/i,
    /onerror/i,
    /<.*>/,
    /union.*select/i,
    /drop.*table/i
  ];
  
  const requestData = JSON.stringify(req.body) + JSON.stringify(req.query);
  const hasSuspiciousContent = suspiciousPatterns.some(pattern => pattern.test(requestData));
  
  if (hasSuspiciousContent) {
    logger.warn('Suspicious request detected:', {
      ...securityInfo,
      suspiciousContent: requestData.substring(0, 200)
    });
  }
  
  next();
};

// IP whitelist/blacklist middleware
const ipFilter = (req, res, next) => {
  const clientIp = req.ip;
  
  // Blacklisted IPs (in production, use a database or external service)
  const blacklistedIPs = new Set([
    // Add known malicious IPs here
  ]);
  
  // Whitelisted IPs for admin access
  const whitelistedIPs = new Set([
    '127.0.0.1',
    '::1',
    // Add trusted IPs here
  ]);
  
  if (blacklistedIPs.has(clientIp)) {
    logger.warn(`Blocked request from blacklisted IP: ${clientIp}`);
    return res.status(403).json({
      error: 'Access denied',
      message: 'Your IP address has been blocked'
    });
  }
  
  // Special handling for admin endpoints
  if (req.path.startsWith('/admin') && !whitelistedIPs.has(clientIp)) {
    logger.warn(`Admin access attempt from non-whitelisted IP: ${clientIp}`);
    return res.status(403).json({
      error: 'Access denied',
      message: 'Admin access restricted to whitelisted IPs'
    });
  }
  
  next();
};

// Request size limiter
const requestSizeLimiter = (req, res, next) => {
  const maxSize = 1024 * 1024; // 1MB
  const contentLength = parseInt(req.get('Content-Length') || '0');
  
  if (contentLength > maxSize) {
    logger.warn(`Request too large: ${contentLength} bytes from ${req.ip}`);
    return res.status(413).json({
      error: 'Request too large',
      message: 'Request body exceeds maximum allowed size',
      maxSize: maxSize,
      receivedSize: contentLength
    });
  }
  
  next();
};

// Security headers middleware
const customSecurityHeaders = (req, res, next) => {
  // Add custom security headers
  res.setHeader('X-API-Version', '1.0.0');
  res.setHeader('X-Powered-By', 'AgriGuard-Platform');
  res.setHeader('X-Request-ID', req.headers['x-request-id'] || 'unknown');
  
  // Remove sensitive headers
  res.removeHeader('X-Powered-By');
  
  next();
};

// Get security statistics
const getSecurityStats = () => {
  // In production, these would come from a database or monitoring system
  return {
    timestamp: new Date().toISOString(),
    securityFeatures: {
      helmet: true,
      xssProtection: true,
      sqlInjectionProtection: true,
      inputValidation: true,
      rateLimiting: true,
      authentication: true,
      authorization: true,
      auditLogging: true
    },
    validationSchemas: Object.keys(validationSchemas).length,
    securityHeaders: [
      'Content-Security-Policy',
      'X-Frame-Options',
      'X-Content-Type-Options',
      'Referrer-Policy',
      'Strict-Transport-Security'
    ]
  };
};

module.exports = {
  securityHeaders,
  validationSchemas,
  handleValidationErrors,
  sanitizeInput,
  securityAuditLogger,
  ipFilter,
  requestSizeLimiter,
  customSecurityHeaders,
  getSecurityStats
};