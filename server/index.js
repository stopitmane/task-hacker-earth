const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');

// Import routes
const authRoutes = require('./routes/auth');
const farmerRoutes = require('./routes/farmers');
const claimsRoutes = require('./routes/claims');
const camaraRoutes = require('./routes/camara');
const agentRoutes = require('./routes/agents');

// Import AI agents
const ClaimAssessmentAgent = require('./ai-agents/ClaimAssessmentAgent');
const FraudDetectionAgent = require('./ai-agents/FraudDetectionAgent');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:3000', 'http://localhost:19006'],
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/agriguard')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Socket.io for real-time updates
io.on('connection', (socket) => {
  console.log('📱 Client connected:', socket.id);
  
  socket.on('join-farmer', (farmerId) => {
    socket.join(`farmer-${farmerId}`);
    console.log(`👨‍🌾 Farmer ${farmerId} joined room`);
  });

  socket.on('disconnect', () => {
    console.log('📱 Client disconnected:', socket.id);
  });
});

// Make io available to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Initialize AI Agents
const claimAgent = new ClaimAssessmentAgent();
const fraudAgent = new FraudDetectionAgent();

app.use((req, res, next) => {
  req.agents = { claimAgent, fraudAgent };
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/farmers', farmerRoutes);
app.use('/api/claims', claimsRoutes);
app.use('/api/camara', camaraRoutes);
app.use('/api/agents', agentRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    services: {
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      aiAgents: 'active'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 AgriGuard server running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;