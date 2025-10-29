const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const https = require('https');
const resumeRoutes = require('./routes/resume');

dotenv.config();

const app = express();

// ✅ CORS Configuration - Allow all origins
const corsOptions = {
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true,
  optionsSuccessStatus: 200,
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// Additional CORS headers for extra compatibility
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Body parsers with increased limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// MongoDB Connection with better error handling
if (process.env.MONGODB_URI) {
  mongoose
    .connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })
    .then(() => console.log('✅ MongoDB Connected'))
    .catch((err) => {
      console.log('❌ MongoDB Connection Error:', err.message);
      // Continue without MongoDB for health checks
    });
} else {
  console.log('⚠️ No MONGODB_URI found in environment variables');
}

// Health Check - Must work even if MongoDB is down
app.get('/', (req, res) => {
  res.json({ 
    success: true,
    message: '🚀 AI ATS Resume Checker API is running!',
    version: '1.0.0',
    status: 'active',
    timestamp: new Date().toISOString(),
    cors: 'enabled for all origins',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    success: true,
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    memory: process.memoryUsage()
  });
});

// Test CORS endpoint
app.get('/test-cors', (req, res) => {
  res.json({
    success: true,
    message: 'CORS is working!',
    origin: req.headers.origin || 'No origin header',
    timestamp: new Date().toISOString(),
    headers: req.headers
  });
});

// Routes - Make sure these are defined
app.use('/api/resume', resumeRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    message: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// Global Error Handling
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  
  // Don't expose internal error details in production
  const errorMessage = process.env.NODE_ENV === 'production' 
    ? 'Something went wrong on the server' 
    : err.message;
  
  res.status(err.status || 500).json({ 
    success: false, 
    message: errorMessage,
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0';

// Start server
const server = app.listen(PORT, HOST, () => {
  console.log('='.repeat(50));
  console.log(`🚀 Server running on ${HOST}:${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⏰ Started at: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
  console.log(`🌐 CORS: Enabled for all origins`);
  console.log('='.repeat(50));
  
  // Keep-alive for production (Render free tier)
  if (process.env.NODE_ENV === 'production') {
    const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://ai-res.onrender.com';
    
    console.log('✅ Keep-alive starting for Render free tier...');
    
    // Initial ping after 1 minute
    setTimeout(() => {
      pingServer(RENDER_URL, 'Initial');
    }, 60000);
    
    // Regular pings every 14 minutes
    setInterval(() => {
      pingServer(RENDER_URL, 'Scheduled');
    }, 14 * 60 * 1000);
    
    console.log('✅ Keep-alive enabled (pings every 14 minutes)');
  }
});

// Improved ping function with error handling
function pingServer(url, type = 'Ping') {
  const pingUrl = `${url}/health`;
  
  https.get(pingUrl, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      if (res.statusCode === 200) {
        console.log(`✅ ${type} keep-alive: ${res.statusCode} at ${new Date().toLocaleTimeString()}`);
      } else {
        console.log(`⚠️ ${type} keep-alive returned: ${res.statusCode}`);
      }
    });
  }).on('error', (err) => {
    console.log(`❌ ${type} keep-alive failed:`, err.message);
  }).setTimeout(10000, function() {
    this.abort();
    console.log('⚠️ Keep-alive request timed out');
  });
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in production
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // Give the process time to finish handling requests
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Graceful shutdown handlers
function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  server.close(() => {
    console.log('✅ Server closed');
    
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

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app; // Export for testing