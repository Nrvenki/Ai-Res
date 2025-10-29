const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables FIRST
dotenv.config();

const app = express();

// ✅ CORS - Must be FIRST middleware
const allowedOrigins = [
  'https://sivaatschecker.netlify.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('❌ Blocked origin:', origin);
      callback(null, true); // Allow anyway during debugging
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ CRITICAL: Health check - MUST respond IMMEDIATELY
app.get('/health', (req, res) => {
  res.status(200).json({ 
    success: true,
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.status(200).json({ 
    success: true,
    message: '🚀 AI ATS Resume Checker API',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Test CORS
app.get('/test-cors', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'CORS working!',
    origin: req.headers.origin || 'No origin'
  });
});

// ✅ Load resume routes ONLY after basic routes work
let resumeRoutes;
try {
  resumeRoutes = require('./routes/resume');
  app.use('/api/resume', resumeRoutes);
  console.log('✅ Resume routes loaded');
} catch (err) {
  console.error('⚠️ Resume routes error:', err.message);
  console.error('Server will start without resume routes');
}

// MongoDB connection - OPTIONAL, non-blocking
if (process.env.MONGODB_URI) {
  const mongoose = require('mongoose');
  mongoose
    .connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.log('⚠️ MongoDB not connected:', err.message));
}

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    message: 'Route not found',
    path: req.path
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(500).json({ 
    success: false, 
    message: err.message || 'Server error'
  });
});

// ✅ CRITICAL: Use Render's PORT (default 10000)
const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0';

// Start server
const server = app.listen(PORT, HOST, () => {
  console.log('='.repeat(50));
  console.log(`🚀 Server running on ${HOST}:${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⏰ Time: ${new Date().toLocaleString()}`);
  console.log('='.repeat(50));
});

// Timeout settings for Render
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

// Error handlers
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  setTimeout(() => process.exit(1), 1000);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

module.exports = app;
