const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Mock user store (in production, this would be a database)
const users = new Map();

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    const { username, password, role = 'farmer' } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (users.has(username)) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      username,
      password: hashedPassword,
      role,
      createdAt: new Date().toISOString()
    };

    users.set(username, user);

    const token = jwt.sign(
      { username, role },
      process.env.JWT_SECRET || 'agriguard-secret',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      data: {
        username,
        role,
        token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Registration failed',
      error: error.message
    });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = users.get(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { username, role: user.role },
      process.env.JWT_SECRET || 'agriguard-secret',
      { expiresIn: '24h' }
    );

    res.json({
      status: 'success',
      message: 'Login successful',
      data: {
        username,
        role: user.role,
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Login failed',
      error: error.message
    });
  }
});

// Verify token middleware
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'agriguard-secret');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Protected route example
router.get('/profile', verifyToken, (req, res) => {
  const user = users.get(req.user.username);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    status: 'success',
    data: {
      username: user.username,
      role: user.role,
      createdAt: user.createdAt
    }
  });
});

// Demo users creation (for hackathon demo)
router.post('/create-demo-users', async (req, res) => {
  try {
    const demoUsers = [
      { username: 'farmer1', password: 'demo123', role: 'farmer' },
      { username: 'admin', password: 'admin123', role: 'admin' },
      { username: 'agent', password: 'agent123', role: 'field_agent' }
    ];

    for (const demoUser of demoUsers) {
      if (!users.has(demoUser.username)) {
        const hashedPassword = await bcrypt.hash(demoUser.password, 10);
        users.set(demoUser.username, {
          ...demoUser,
          password: hashedPassword,
          createdAt: new Date().toISOString()
        });
      }
    }

    res.json({
      status: 'success',
      message: 'Demo users created',
      data: {
        users: demoUsers.map(u => ({ username: u.username, role: u.role }))
      }
    });
  } catch (error) {
    console.error('Demo users creation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create demo users',
      error: error.message
    });
  }
});

module.exports = { router, verifyToken };