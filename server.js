const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();

// ✅ Allowed origins
const allowedOrigins = [
  'https://sivaatschecker.netlify.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5174'
];

// ✅ CORS Configuration - NO credentials needed
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (Postman, mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // Log unknown origins but still allow (for debugging)
      console.log('⚠️ Request from unlisted origin:', origin);
      callback(null, true);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400 // 24 hours
}));

// Additional CORS headers
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ Basic Routes - Must come FIRST
app.get('/', (req, res) => {
  res.json({ 
    success: true,
    message: '🚀 AI ATS Resume Checker API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    success: true,
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage()
  });
});

app.get('/test-cors', (req, res) => {
  res.json({ 
    success: true,
    message: 'CORS is working perfectly!', 
    origin: req.headers.origin || 'No origin header',
    allowedOrigins: allowedOrigins,
    timestamp: new Date().toISOString()
  });
});

// ✅ Resume Routes - with error handling
let resumeRoutesLoaded = false;
try {
  const resumeRoutes = require('./routes/resume');
  app.use('/api/resume', resumeRoutes);
  resumeRoutesLoaded = true;
  console.log('✅ Resume routes loaded successfully');
} catch (error) {
  console.error('❌ Failed to load resume routes:', error.message);
  console.error(error.stack);
  
  // Fallback routes
  app.post('/api/resume/analyze', (req, res) => {
    res.status(503).json({
      success: false,
      message: 'Resume analysis service temporarily unavailable',
      error: 'Routes failed to load'
    });
  });
  
  app.get('/api/resume/reports', (req, res) => {
    res.status(503).json({
      success: false,
      message: 'Reports service temporarily unavailable',
      error: 'Routes failed to load'
    });
  });
}

// ✅ MongoDB Connection - OPTIONAL and NON-BLOCKING
if (process.env.MONGODB_URI) {
  try {
    const mongoose = require('mongoose');
    mongoose.set('strictQuery', false);
    
    mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })
      .then(() => {
        console.log('✅ MongoDB connected successfully');
      })
      .catch(err => {
        console.log('⚠️ MongoDB connection failed (using file storage):', err.message);
      });
  } catch (error) {
    console.log('⚠️ MongoDB module not available, using file storage');
  }
} else {
  console.log('ℹ️ MongoDB URI not configured, using file storage');
}

// ✅ 404 Handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    message: 'Route not found',
    path: req.path,
    method: req.method,
    availableRoutes: {
      health: 'GET /',
      healthCheck: 'GET /health',
      testCors: 'GET /test-cors',
      analyze: 'POST /api/resume/analyze',
      reports: 'GET /api/resume/reports'
    }
  });
});

// ✅ Global Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Global Error Handler:');
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);
  
  res.status(err.status || 500).json({ 
    success: false, 
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'production' ? 'Server error' : err.stack
  });
});

// ✅ Server Configuration
const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0';

// Start server
const server = app.listen(PORT, HOST, (err) => {
  if (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🚀 SERVER STARTED SUCCESSFULLY!');
  console.log('='.repeat(60));
  console.log(`📍 Host: ${HOST}`);
  console.log(`🔌 Port: ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📦 Resume Routes: ${resumeRoutesLoaded ? '✅ Loaded' : '❌ Failed'}`);
  console.log(`🗄️  MongoDB: ${process.env.MONGODB_URI ? '✅ Configured' : 'ℹ️ File Storage'}`);
  console.log(`🌍 Allowed Origins:`);
  allowedOrigins.forEach(origin => console.log(`   - ${origin}`));
  console.log(`⏰ Started at: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
  console.log('='.repeat(60) + '\n');
});

// ✅ Server timeout settings (important for Render)
server.keepAliveTimeout = 120000; // 2 minutes
server.headersTimeout = 120000;
server.timeout = 120000;

// Handle server startup errors
server.on('error', (err) => {
  console.error('❌ Server error:', err);
  
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    console.error('Try: killall node (or restart your computer)');
    process.exit(1);
  }
  
  if (err.code === 'EACCES') {
    console.error(`❌ Permission denied for port ${PORT}`);
    console.error('Try using a port number > 1024');
    process.exit(1);
  }
});

// ✅ Graceful Shutdown Handlers
const shutdown = (signal) => {
  console.log(`\n⚠️ ${signal} received. Starting graceful shutdown...`);
  
  server.close(() => {
    console.log('✅ HTTP server closed');
    
    // Close MongoDB if connected
    if (process.env.MONGODB_URI) {
      try {
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState === 1) {
          mongoose.connection.close(false, () => {
            console.log('✅ MongoDB connection closed');
            process.exit(0);
          });
        } else {
          process.exit(0);
        }
      } catch (err) {
        console.log('⚠️ MongoDB not connected');
        process.exit(0);
      }
    } else {
      process.exit(0);
    }
  });
  
  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('⚠️ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ✅ Unhandled Errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection:');
  console.error('Reason:', reason);
  console.error('Promise:', promise);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:');
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);
  
  // Give time to log before exit
  setTimeout(() => {
    console.log('Exiting due to uncaught exception...');
    process.exit(1);
  }, 1000);
});

// Export for testing
module.exports = app;
