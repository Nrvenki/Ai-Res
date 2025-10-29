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

// ✅ CORS headers for this router too
router.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  next();
});

// Create reports directory
const reportsDir = path.join(__dirname, '../reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir);
}

const reportsFile = path.join(reportsDir, 'reports.json');

// Helper functions
const readReports = () => {
  try {
    if (fs.existsSync(reportsFile)) {
      const data = fs.readFileSync(reportsFile, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.log('Read error:', error.message);
  }
  return [];
};

const writeReports = (reports) => {
  try {
    fs.writeFileSync(reportsFile, JSON.stringify(reports, null, 2));
  } catch (error) {
    console.log('Write error:', error.message);
  }
};

// Multer config
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// ✅ Analyze endpoint
router.post('/analyze', upload.single('resume'), async (req, res) => {
  try {
    const { jobDescription } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a resume file'
      });
    }

    if (!jobDescription || jobDescription.trim().length < 50) {
      return res.status(400).json({
        success: false,
        message: 'Please provide job description (min 50 characters)'
      });
    }

    console.log('📄 Parsing resume...');
    const resumeText = await parseResume(file);

    if (!resumeText || resumeText.length < 100) {
      return res.status(400).json({
        success: false,
        message: 'Could not extract text from resume'
      });
    }

    console.log('📊 Calculating score...');
    const { totalScore, breakdown } = calculateATSScore(resumeText, jobDescription);

    console.log('💡 Generating insights...');
    const { strengths, weaknesses } = generateInsights(breakdown, resumeText, jobDescription);

    console.log('🤖 Generating suggestions...');
    const suggestions = await generateAISuggestions(resumeText, jobDescription, breakdown);

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

    // Save to file
    try {
      const reportData = {
        _id: Date.now().toString(),
        atsScore: totalScore,
        breakdown,
        suggestions,
        strengths,
        weaknesses,
        createdAt: new Date().toISOString()
      };

      const reports = readReports();
      reports.unshift(reportData);
      if (reports.length > 50) reports.splice(50);
      writeReports(reports);
      
      console.log('✅ Report saved');
    } catch (err) {
      console.log('⚠️ Save failed:', err.message);
    }

    res.json(result);

  } catch (error) {
    console.error('❌ Analyze error:', error);
    res.status(500).json({
      success: false,
      message: 'Analysis failed',
      error: error.message
    });
  }
});

// Get reports
router.get('/reports', async (req, res) => {
  try {
    const reports = readReports();
    res.json({
      success: true,
      data: reports.slice(0, 10)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reports'
    });
  }
});

module.exports = router;
