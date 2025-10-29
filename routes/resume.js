const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { parseResume } = require('../utils/resumeParser');
const { calculateATSScore, generateInsights } = require('../utils/atsScoring');
const { generateAISuggestions } = require('../utils/aiSuggestions');
const Report = require('../models/Report');

const router = express.Router();

// Create reports directory if it doesn't exist
const reportsDir = path.join(__dirname, '../reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir);
}

const reportsFile = path.join(reportsDir, 'reports.json');

// Helper functions for file-based storage
const readReports = () => {
  try {
    if (fs.existsSync(reportsFile)) {
      const data = fs.readFileSync(reportsFile, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.log('Error reading reports:', error.message);
  }
  return [];
};

const writeReports = (reports) => {
  try {
    fs.writeFileSync(reportsFile, JSON.stringify(reports, null, 2));
    console.log('✅ Reports saved to file successfully');
  } catch (error) {
    console.log('Error writing reports:', error.message);
  }
};

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.mimetype === 'application/msword'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX files are allowed!'), false);
    }
  }
});

// Main endpoint: Analyze Resume
router.post('/analyze', upload.single('resume'), async (req, res) => {
  try {
    const { jobDescription } = req.body;
    const file = req.file;

    // Validation
    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a resume file (PDF or DOCX)'
      });
    }

    if (!jobDescription || jobDescription.trim().length < 50) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a detailed job description (at least 50 characters)'
      });
    }

    // Parse resume
    console.log('📄 Parsing resume...');
    const resumeText = await parseResume(file);

    if (!resumeText || resumeText.length < 100) {
      return res.status(400).json({
        success: false,
        message: 'Could not extract enough text from resume. Please ensure the file is readable.'
      });
    }

    console.log('📝 Resume text length:', resumeText.length, 'characters');

    // Calculate ATS Score
    console.log('📊 Calculating ATS score...');
    const { totalScore, breakdown } = calculateATSScore(resumeText, jobDescription);

    // Generate Insights
    console.log('💡 Generating insights...');
    const { strengths, weaknesses } = generateInsights(breakdown, resumeText, jobDescription);

    // Generate AI Suggestions
    console.log('🤖 Generating AI suggestions...');
    const suggestions = await generateAISuggestions(resumeText, jobDescription, breakdown);

    // Prepare response
    const result = {
      success: true,
      data: {
        atsScore: totalScore,
        breakdown,
        strengths,
        weaknesses,
        suggestions,
        resumeWordCount: resumeText.split(/\s+/).length,
        analyzedAt: new Date().toISOString()
      }
    };

    // Save to file-based storage
    const reportData = {
      _id: Date.now().toString(),
      userId: 'guest',
      resumeText: resumeText.substring(0, 1000),
      jobDescription: jobDescription.substring(0, 500),
      atsScore: totalScore,
      breakdown,
      suggestions,
      strengths,
      weaknesses,
      createdAt: new Date().toISOString()
    };

    try {
      const reports = readReports();
      reports.unshift(reportData);
      // Keep only last 50 reports
      if (reports.length > 50) {
        reports.splice(50);
      }
      writeReports(reports);
      result.data.reportId = reportData._id;
      console.log('✅ Report saved to file (Total reports:', reports.length, ')');
    } catch (fileError) {
      console.log('⚠️ Could not save to file:', fileError.message);
    }

    // Try to save to MongoDB if connected
    try {
      if (mongoose.connection.readyState === 1) {
        const report = new Report(reportData);
        await report.save();
        console.log('✅ Report also saved to MongoDB');
      } else {
        console.log('⚠️ MongoDB not connected - using file storage only');
      }
    } catch (dbError) {
      console.log('⚠️ Could not save to MongoDB:', dbError.message);
    }

    console.log('✅ Analysis complete! Score:', totalScore);
    res.json(result);

  } catch (error) {
    console.error('❌ Error analyzing resume:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze resume',
      error: error.message
    });
  }
});

// Get saved reports (file-based + MongoDB)
router.get('/reports', async (req, res) => {
  try {
    let reports = [];

    // Try MongoDB first
    try {
      if (mongoose.connection.readyState === 1) {
        const dbReports = await Report.find()
          .sort({ createdAt: -1 })
          .limit(10)
          .select('-resumeText -jobDescription');
        reports = dbReports;
        console.log('✅ Loaded', reports.length, 'reports from MongoDB');
      }
    } catch (dbError) {
      console.log('⚠️ MongoDB not available');
    }

    // Fallback to file-based storage
    if (reports.length === 0) {
      const fileReports = readReports();
      reports = fileReports.slice(0, 10).map(r => ({
        _id: r._id,
        atsScore: r.atsScore,
        createdAt: r.createdAt,
        breakdown: r.breakdown,
        suggestions: r.suggestions
      }));
      console.log('✅ Loaded', reports.length, 'reports from file storage');
    }

    res.json({
      success: true,
      data: reports
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reports',
      error: error.message
    });
  }
});

// Get single report
router.get('/reports/:id', async (req, res) => {
  try {
    let report = null;

    // Try MongoDB first
    try {
      if (mongoose.connection.readyState === 1) {
        report = await Report.findById(req.params.id);
      }
    } catch (dbError) {
      console.log('⚠️ MongoDB not available');
    }

    // Fallback to file-based storage
    if (!report) {
      const reports = readReports();
      report = reports.find(r => r._id === req.params.id);
    }

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch report',
      error: error.message
    });
  }
});

module.exports = router;
