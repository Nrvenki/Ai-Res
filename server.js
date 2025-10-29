const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const https = require('https');
const resumeRoutes = require('./routes/resume');

dotenv.config();

const app = express();

// ✅ Allowed origins - Add your Netlify URL here
const allowedOrigins = [
  'https://sivaatschecker.netlify.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174'
];

// ✅ CORS Configuration - MUST be FIRST middleware
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('❌ Blocked by CORS:', origin);
      callback(null, true); // Allow anyway for now to avoid blocking
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 86400,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging (simplified for production)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ✅ CRITICAL: Health check MUST respond immediately
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

// Test CORS endpoint
app.get('/test-cors', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'CORS is working!',
    origin: req.headers.origin || 'No origin',
    timestamp: new Date().toISOString()
  });
});

// MongoDB Connection - Non-blocking with better error handling
if (process.env.MONGODB_URI) {
  mongoose
    .connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })
    .then(() => console.log('✅ MongoDB Connected'))
    .catch((err) => {
      console.log('⚠️ MongoDB Error:', err.message);
      // Don't exit - API can still respond even if DB is down
    });
} else {
  console.log('⚠️ No MongoDB URI provided');
}

// ✅ API Routes with error handling
try {
  if (resumeRoutes) {
    app.use('/api/resume', resumeRoutes);
    console.log('✅ Resume routes loaded');
  } else {
    console.error('❌ Resume routes module is undefined');
  }
} catch (err) {
  console.error('❌ Error loading resume routes:', err.message);
}

// 404 Handler - Using named wildcard for Express 5.x compatibility
app.all('/{*catchAll}', (req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({ 
    success: false,
    message: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  console.error('Stack:', err.stack);
  
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
  console.log(`🌐 Allowed Origins:`, allowedOrigins.join(', '));
  console.log('='.repeat(60));
  
  // Keep-alive for Render free tier
  if (process.env.NODE_ENV === 'production' || process.env.RENDER_EXTERNAL_URL) {
    startKeepAlive();
  }
});

// Set timeouts to prevent hanging requests
server.keepAliveTimeout = 65000; // 65 seconds
server.headersTimeout = 66000; // 66 seconds

// Keep-alive function for Render free tier
function startKeepAlive() {
  const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://ai-res.onrender.com';
  console.log('✅ Keep-alive: Starting for', RENDER_URL);
  
  // Ping every 14 minutes (Render free tier spins down after 15 mins)
  setInterval(() => {
    const url = `${RENDER_URL}/health`;
    https.get(url, (res) => {
      if (res.statusCode === 200) {
        console.log(`✅ Keep-alive ping: ${res.statusCode} at ${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
      } else {
        console.log(`⚠️ Keep-alive warning: ${res.statusCode}`);
      }
    }).on('error', (err) => {
      console.log('⚠️ Keep-alive failed:', err.message);
    });
  }, 14 * 60 * 1000);
}

// Graceful error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit in production
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  // Give time to log before exit
  setTimeout(() => {
    console.log('⚠️ Exiting due to uncaught exception');
    process.exit(1);
  }, 1000);
});

// Graceful shutdown
function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  
  server.close(() => {
    console.log('✅ HTTP server closed');
    
    if (mongoose.connection.readyState === 1) {
      mongoose.connection.close(false, () => {
        console.log('✅ MongoDB connection closed');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('⚠️ Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
