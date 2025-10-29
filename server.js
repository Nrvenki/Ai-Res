const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const https = require('https');
const resumeRoutes = require('./routes/resume');

dotenv.config();

const app = express();

// ✅ CRITICAL: CORS must be the FIRST middleware
app.use(cors({
  origin: true, // Allows all origins dynamically
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Emergency CORS fallback
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'}`);
  next();
});

// MongoDB Connection - Non-blocking
if (process.env.MONGODB_URI) {
  mongoose
    .connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })
    .then(() => console.log('✅ MongoDB Connected'))
    .catch((err) => console.log('⚠️ MongoDB Error:', err.message));
}

// ✅ HEALTH CHECK - Must respond IMMEDIATELY
app.get('/health', (req, res) => {
  res.status(200).json({ 
    success: true,
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

app.get('/', (req, res) => {
  res.status(200).json({ 
    success: true,
    message: '🚀 AI ATS Resume Checker API is running!',
    version: '1.0.0',
    status: 'active',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Test CORS
app.get('/test-cors', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'CORS is working!',
    origin: req.headers.origin || 'No origin',
    timestamp: new Date().toISOString()
  });
});

// ✅ ROUTES - Make sure resumeRoutes is valid
try {
  app.use('/api/resume', resumeRoutes);
  console.log('✅ Resume routes loaded');
} catch (err) {
  console.error('❌ Error loading resume routes:', err.message);
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
  res.status(err.status || 500).json({ 
    success: false, 
    message: err.message || 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0';

// Start Server
const server = app.listen(PORT, HOST, () => {
  console.log('='.repeat(60));
  console.log(`🚀 Server RUNNING on ${HOST}:${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⏰ Started: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
  console.log(`🌐 CORS: ENABLED for all origins`);
  console.log('='.repeat(60));
  
  // Keep-alive for Render free tier
  if (process.env.NODE_ENV === 'production') {
    startKeepAlive();
  }
});

// Keep-alive function
function startKeepAlive() {
  const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://ai-res.onrender.com';
  console.log('✅ Keep-alive: Starting...');
  
  // Ping every 14 minutes
  setInterval(() => {
    const url = `${RENDER_URL}/health`;
    https.get(url, (res) => {
      console.log(`✅ Keep-alive: ${res.statusCode} at ${new Date().toLocaleTimeString()}`);
    }).on('error', (err) => {
      console.log('⚠️ Keep-alive failed:', err.message);
    });
  }, 14 * 60 * 1000);
}

// Error handlers
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  setTimeout(() => process.exit(1), 1000);
});

// Graceful shutdown
function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down...`);
  server.close(() => {
    console.log('✅ Server closed');
    if (mongoose.connection.readyState === 1) {
      mongoose.connection.close(false, () => {
        console.log('✅ MongoDB closed');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });
  
  setTimeout(() => {
    console.error('⚠️ Forcing shutdown');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;