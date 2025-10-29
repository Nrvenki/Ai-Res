const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// ✅ Step 1: Enable CORS for EVERYTHING
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ Step 2: Basic routes FIRST
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
  res.json({ message: 'CORS working!', origin: req.headers.origin });
});

// ✅ Step 3: Resume routes - with TRY-CATCH
try {
  const resumeRoutes = require('./routes/resume');
  app.use('/api/resume', resumeRoutes);
  console.log('✅ Routes loaded');
} catch (error) {
  console.error('❌ Routes error:', error.message);
}

// ✅ Step 4: MongoDB - OPTIONAL
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

// ✅ Start server
const PORT = process.env.PORT || 10000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
});
