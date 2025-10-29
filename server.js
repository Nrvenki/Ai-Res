const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// ✅ CORS Fix - credentials இருக்கும்போது specific origin வேணும்
const allowedOrigins = [
  'https://sivaatschecker.netlify.app',
  'http://localhost:5173',
  'http://localhost:3000'
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Still allow, but log it
      console.log('⚠️ Origin not in whitelist:', origin);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400 // 24 hours
}));

// Manual CORS headers
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: '✅ Server is running!',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.get('/test-cors', (req, res) => {
  res.json({ 
    message: 'CORS working!', 
    origin: req.headers.origin,
    allowedOrigins: allowedOrigins
  });
});

// Resume routes
try {
  const resumeRoutes = require('./routes/resume');
  app.use('/api/resume', resumeRoutes);
  console.log('✅ Routes loaded');
} catch (error) {
  console.error('❌ Routes error:', error.message);
}

// MongoDB
try {
  if (process.env.MONGODB_URI) {
    const mongoose = require('mongoose');
    mongoose.connect(process.env.MONGODB_URI)
      .then(() => console.log('✅ MongoDB OK'))
      .catch(err => console.log('⚠️ MongoDB failed:', err.message));
  }
} catch (error) {
  console.log('⚠️ MongoDB skip');
}

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: err.message });
});

// Start server
const PORT = process.env.PORT || 10000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Allowed origins:`, allowedOrigins);
});
