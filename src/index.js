const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const cron = require('node-cron');

// Load environment variables
dotenv.config();

// Import modules
const logger = require('./utils/logger');
const camaraService = require('./services/camaraService');
const aiAgent = require('./services/aiAgent');
const insuranceRoutes = require('./routes/insurance');
const farmerRoutes = require('./routes/farmer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/insurance', insuranceRoutes);
app.use('/api/farmer', farmerRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'AgriGuard Insurance Platform'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to AgriGuard - Smart Agricultural Insurance Platform',
    version: '1.0.0',
    apis: ['Location', 'SIM Swap', 'Device Status'],
    features: ['AI Agent', 'Fraud Detection', 'Location Verification', 'Automated Payouts']
  });
});

// Scheduled tasks - AI Agent monitoring
cron.schedule('*/15 * * * *', async () => {
  logger.info('Running scheduled AI agent monitoring...');
  try {
    await aiAgent.monitorActivePolicies();
  } catch (error) {
    logger.error('Scheduled monitoring failed:', error);
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`AgriGuard server running on port ${PORT}`);
  logger.info('CAMARA APIs: Location, SIM Swap, Device Status');
  logger.info('AI Agent: Active monitoring enabled');
});