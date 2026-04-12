const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const logger = require('../utils/logger');

// Store for tracking rate limit violations
const violationStore = new Map();

// Custom rate limit handler
const rateLimitHandler = (req, res) => {
  const clientId = req.ip || 'unknown';
  const endpoint = req.path;
  
  // Track violations
  const violationKey = `${clientId}:${endpoint}`;
  const violations = violationStore.get(violationKey) || 0;
  violationStore.set(violationKey, violations + 1);
  
  logger.warn(`Rate limit exceeded for ${clientId} on ${req.method} ${endpoint} (violation #${violations + 1})`);
  
  res.status(429).json({
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
    limit: req.rateLimit.limit,
    remaining: req.rateLimit.remaining,
    resetTime: new Date(req.rateLimit.resetTime).toISOString()
  });
};

// Skip rate limiting for certain conditions
const skipRateLimit = (req) => {
  // Skip for health checks
  if (req.path === '/health') return true;
  
  // Skip for admin users (in production, be more careful with this)
  if (req.user && req.user.role === 'admin') return true;
  
  // Skip for trusted API keys
  if (req.apiKey && req.apiKey.name === 'Nokia Integration Demo') return true;
  
  return false;
};

// General API rate limiting
const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: rateLimitHandler,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: skipRateLimit,
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP
    return req.user?.id || req.apiKey?.id || req.ip;
  }
});

// Strict rate limiting for authentication endpoints
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  keyGenerator: (req) => req.ip
});

// CAMARA API rate limiting (more restrictive)
const camaraRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Limit to 10 CAMARA API calls per minute
  message: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimit,
  keyGenerator: (req) => {
    return req.user?.id || req.apiKey?.id || req.ip;
  }
});

// Claim processing rate limiting
const claimRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // Limit to 3 claims per 5 minutes per user
  message: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Must be authenticated to submit claims
    return req.user?.id || req.ip;
  }
});

// Progressive delay for repeated requests
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // Allow 50 requests per windowMs without delay
  delayMs: 500, // Add 500ms delay per request after delayAfter
  maxDelayMs: 20000, // Maximum delay of 20 seconds
  skip: skipRateLimit,
  keyGenerator: (req) => {
    return req.user?.id || req.apiKey?.id || req.ip;
  },
  onLimitReached: (req, res, options) => {
    logger.warn(`Speed limit reached for ${req.ip} on ${req.method} ${req.path}`);
  }
});

// Burst protection for high-frequency endpoints
const burstProtection = rateLimit({
  windowMs: 1000, // 1 second
  max: 5, // Max 5 requests per second
  message: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimit
});

// Custom middleware to log rate limit info
const rateLimitLogger = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Log rate limit headers if present
    if (res.get('RateLimit-Limit')) {
      logger.debug(`Rate limit info for ${req.method} ${req.path}:`, {
        limit: res.get('RateLimit-Limit'),
        remaining: res.get('RateLimit-Remaining'),
        reset: res.get('RateLimit-Reset'),
        clientId: req.user?.id || req.apiKey?.id || req.ip
      });
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

// Get rate limiting statistics
const getRateLimitStats = () => {
  const violations = Array.from(violationStore.entries()).map(([key, count]) => {
    const [clientId, endpoint] = key.split(':');
    return { clientId, endpoint, violations: count };
  });
  
  return {
    totalViolations: violations.reduce((sum, v) => sum + v.violations, 0),
    uniqueViolators: violations.length,
    topViolators: violations
      .sort((a, b) => b.violations - a.violations)
      .slice(0, 10),
    violationsByEndpoint: violations.reduce((acc, v) => {
      acc[v.endpoint] = (acc[v.endpoint] || 0) + v.violations;
      return acc;
    }, {})
  };
};

// Clean up old violation records (run periodically)
const cleanupViolations = () => {
  const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
  let cleaned = 0;
  
  for (const [key, violations] of violationStore.entries()) {
    // Simple cleanup - in production, you'd want timestamp-based cleanup
    if (violations < 5) { // Keep only serious violators
      violationStore.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    logger.info(`Cleaned up ${cleaned} old rate limit violation records`);
  }
};

// Run cleanup every hour
setInterval(cleanupViolations, 60 * 60 * 1000);

module.exports = {
  generalRateLimit,
  authRateLimit,
  camaraRateLimit,
  claimRateLimit,
  speedLimiter,
  burstProtection,
  rateLimitLogger,
  getRateLimitStats
};