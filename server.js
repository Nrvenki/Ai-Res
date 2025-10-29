const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// ✅ CORS - Super simple
app.use(cors({
  origin: 'https://sivaatschecker.netlify.app',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ Test routes
app.get('/', (req, res) => {
  res.json({ message: 'API Running', timestamp: new Date().toISOString() });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ✅ Resume routes - PROTECTED with try-catch
let resumeRoutesLoaded = false;
try {
  const resumeRoutes = require('./routes/resume');
  app.use('/api/resume', resumeRoutes);
  resumeRoutesLoaded = true;
  console.log('✅ Resume routes loaded');
} catch (error) {
  console.error('❌ Resume routes failed:', error.message);
  console.error(error.stack);
  
  // Fallback route
  app.post('/api/resume/analyze', (req, res) => {
    res.status(503).json({
      success: false,
      message: 'Service temporarily unavailable',
      error: 'Routes not loaded'
    });
  });
}

// MongoDB - completely optional
if (process.env.MONGODB_URI) {
  try {
    const mongoose = require('mongoose');
    mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    })
      .then(() => console.log('✅ MongoDB connected'))
      .catch(err => console.log('⚠️ MongoDB skip:', err.message));
  } catch (err) {
    console.log('⚠️ MongoDB module not available');
  }
}

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(500).json({ error: 'Server error' });
});

// ✅ Start server
const PORT = process.env.PORT || 10000;

const server = app.listen(PORT, '0.0.0.0', (err) => {
  if (err) {
    console.error('❌ Server failed to start:', err);
    process.exit(1);
  }
  console.log('\n' + '='.repeat(50));
  console.log(`✅ SERVER STARTED SUCCESSFULLY`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Env: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📦 Routes: ${resumeRoutesLoaded ? 'Loaded' : 'Failed'}`);
  console.log('='.repeat(50) + '\n');
});

// Handle server errors
server.on('error', (err) => {
  console.error('❌ Server error:', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
    process.exit(1);
  }
});

module.exports = app;
