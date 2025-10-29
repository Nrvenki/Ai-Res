const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const https = require('https');
const resumeRoutes = require('./routes/resume');

dotenv.config();

const app = express();

// ✅ CORS - Simple and works
app.use(cors());

// Additional CORS headers
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// MongoDB Connection
if (process.env.MONGODB_URI) {
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch((err) => console.log('❌ MongoDB Connection Error:', err));
}

// Routes
app.use('/api/resume', resumeRoutes);

// Health Check
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 AI ATS Resume Checker API is running!',
    version: '1.0.0',
    status: 'active',
    timestamp: new Date().toISOString(),
    cors: 'enabled for all origins'
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Test CORS endpoint
app.get('/test-cors', (req, res) => {
  res.json({
    success: true,
    message: 'CORS is working!',
    origin: req.headers.origin || 'No origin header',
    timestamp: new Date().toISOString()
  });
});

// Error Handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false, 
    message: 'Something went wrong!', 
    error: err.message 
  });
});

const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0';

// Start server
const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on ${HOST}:${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⏰ Started at: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
  
  // Keep-alive for production
  if (process.env.NODE_ENV === 'production') {
    const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://ai-res.onrender.com';
    
    console.log('✅ Keep-alive starting...');
    
    // Initial ping after 1 minute
    setTimeout(() => {
      https.get(RENDER_URL, (res) => {
        console.log(`✅ Initial keep-alive ping: ${res.statusCode}`);
      }).on('error', (err) => {
        console.log('⚠️ Initial ping failed:', err.message);
      });
    }, 60000);
    
    // Regular pings every 14 minutes
    setInterval(() => {
      https.get(RENDER_URL, (res) => {
        console.log(`✅ Keep-alive ping: ${res.statusCode} at ${new Date().toLocaleTimeString()}`);
      }).on('error', (err) => {
        console.log('⚠️ Keep-alive failed:', err.message);
      });
    }, 14 * 60 * 1000);
    
    console.log('✅ Keep-alive enabled (pings every 14 minutes)');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Closing server...');
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
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received. Closing server...');
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
});
