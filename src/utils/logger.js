const winston = require('winston');
const path = require('path');

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
    let logMessage = `${timestamp} [${service}] ${level}: ${message}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta)}`;
    }
    
    return logMessage;
  })
);

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create logger instance with multiple transports
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'agriguard-platform' },
  transports: [
    // Error logs
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'), 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Combined logs
    new winston.transports.File({ 
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 10,
      tailable: true
    }),
    
    // Security audit logs
    new winston.transports.File({ 
      filename: path.join(logsDir, 'security.log'),
      level: 'warn',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    
    // API access logs
    new winston.transports.File({ 
      filename: path.join(logsDir, 'api-access.log'),
      level: 'info',
      maxsize: 10485760, // 10MB
      maxFiles: 7,
      tailable: true,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ],
  
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'exceptions.log'),
      maxsize: 5242880,
      maxFiles: 3
    })
  ],
  
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'rejections.log'),
      maxsize: 5242880,
      maxFiles: 3
    })
  ]
});

// Console logging for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
        let logMessage = `${timestamp} [${service}] ${level}: ${message}`;
        
        // Add metadata in development
        if (Object.keys(meta).length > 0) {
          logMessage += `\n${JSON.stringify(meta, null, 2)}`;
        }
        
        return logMessage;
      })
    )
  }));
}

// Custom logging methods for different types of events
logger.security = (message, meta = {}) => {
  logger.warn(message, { ...meta, category: 'security' });
};

logger.audit = (message, meta = {}) => {
  logger.info(message, { ...meta, category: 'audit' });
};

logger.performance = (message, meta = {}) => {
  logger.info(message, { ...meta, category: 'performance' });
};

logger.business = (message, meta = {}) => {
  logger.info(message, { ...meta, category: 'business' });
};

// Log statistics and monitoring
logger.getStats = () => {
  const stats = {
    timestamp: new Date().toISOString(),
    logLevel: logger.level,
    transports: logger.transports.length,
    logFiles: [
      'error.log',
      'combined.log', 
      'security.log',
      'api-access.log',
      'exceptions.log',
      'rejections.log'
    ]
  };
  
  // Get file sizes if possible
  try {
    stats.logFileSizes = {};
    stats.logFiles.forEach(file => {
      const filePath = path.join(logsDir, file);
      if (fs.existsSync(filePath)) {
        const stats_file = fs.statSync(filePath);
        stats.logFileSizes[file] = {
          size: stats_file.size,
          modified: stats_file.mtime
        };
      }
    });
  } catch (error) {
    logger.error('Error getting log file stats:', error);
  }
  
  return stats;
};

// Log rotation and cleanup
logger.cleanup = () => {
  const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
  const now = Date.now();
  
  try {
    const files = fs.readdirSync(logsDir);
    let cleaned = 0;
    
    files.forEach(file => {
      const filePath = path.join(logsDir, file);
      const stats = fs.statSync(filePath);
      
      if (now - stats.mtime.getTime() > maxAge) {
        fs.unlinkSync(filePath);
        cleaned++;
      }
    });
    
    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} old log files`);
    }
  } catch (error) {
    logger.error('Error during log cleanup:', error);
  }
};

// Run cleanup weekly
setInterval(logger.cleanup, 7 * 24 * 60 * 60 * 1000);

module.exports = logger;