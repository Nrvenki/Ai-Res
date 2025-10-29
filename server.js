const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Load environment variables FIRST
dotenv.config();

const app = express();

// ✅ Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ✅ Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, and DOCX files are allowed'));
    }
  }
});

// ✅ CORS Configuration - MUST be FIRST
const allowedOrigins = [
  'https://sivaatschecker.netlify.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (Postman, mobile apps, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('❌ Blocked origin:', origin);
      callback(null, true); // Allow anyway for now
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  maxAge: 86400
}));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'}`);
  next();
});

// ✅ CRITICAL: Health check
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

// ✅ Resume Analysis Endpoint with Multer
app.post('/api/resume/analyze', upload.single('resume'), async (req, res) => {
  try {
    console.log('📄 Resume analysis request received');
    console.log('File:', req.file);
    console.log('Job Description length:', req.body.jobDescription?.length);

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No resume file uploaded'
      });
    }

    if (!req.body.jobDescription || req.body.jobDescription.trim().length < 50) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Job description must be at least 50 characters'
      });
    }

    // TODO: Add your AI analysis logic here
    // For now, return a mock response
    const mockResult = {
      atsScore: 75,
      matchedKeywords: ['JavaScript', 'React', 'Node.js', 'MongoDB'],
      missingKeywords: ['Docker', 'Kubernetes', 'AWS'],
      suggestions: [
        'Add more specific technical skills',
        'Include quantifiable achievements',
        'Use industry-standard terminology'
      ],
      fileName: req.file.originalname
    };

    // Clean up uploaded file after processing
    setTimeout(() => {
      try {
        fs.unlinkSync(req.file.path);
        console.log('✅ Temp file cleaned up');
      } catch (err) {
        console.log('⚠️ Could not delete temp file:', err.message);
      }
    }, 5000);

    res.status(200).json({
      success: true,
      data: mockResult
    });

  } catch (error) {
    console.error('❌ Analysis error:', error);
    
    // Clean up file if error occurs
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to analyze resume'
    });
  }
});

// MongoDB connection - OPTIONAL
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

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  
  // Handle Multer errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 10MB'
      });
    }
  }
  
  res.status(err.status || 500).json({ 
    success: false, 
    message: err.message || 'Server error'
  });
});

// ✅ CRITICAL: Use Render's PORT
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

// Timeout settings
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

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

module.exports = app;
