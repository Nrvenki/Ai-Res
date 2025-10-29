const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { parseResume } = require('../utils/resumeParser');
const { calculateATSScore, generateInsights } = require('../utils/atsScoring');
const { generateAISuggestions } = require('../utils/aiSuggestions');

const router = express.Router();

// Create reports directory
const reportsDir = path.join(__dirname, '../reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
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
    console.log('⚠️ Read error:', error.message);
  }
  return [];
};

const writeReports = (reports) => {
  try {
    fs.writeFileSync(reportsFile, JSON.stringify(reports, null, 2));
  } catch (error) {
    console.log('⚠️ Write error:', error.message);
  }
};

// Multer config
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX files are allowed'));
    }
  }
});

// ✅ Analyze endpoint
router.post('/analyze', upload.single('resume'), async (req, res) => {
  try {
    console.log('📥 Analyze request received');
    
    const { jobDescription } = req.body;
    const file = req.file;

    // Validation
    if (!file) {
      console.log('❌ No file uploaded');
      return res.status(400).json({
        success: false,
        message: 'Please upload a resume file (PDF or DOCX)'
      });
    }

    console.log('📄 File received:', file.originalname, file.mimetype, file.size + ' bytes');

    if (!jobDescription || jobDescription.trim().length < 50) {
      console.log('❌ Job description too short:', jobDescription?.length || 0);
      return res.status(400).json({
        success: false,
        message: 'Please provide a detailed job description (at least 50 characters)'
      });
    }

    console.log('📄 Parsing resume...');
    const resumeText = await parseResume(file);

    if (!resumeText || resumeText.length < 100) {
      console.log('❌ Could not extract enough text:', resumeText?.length || 0);
      return res.status(400).json({
        success: false,
        message: 'Could not extract enough text from resume. Please ensure the file is readable and not a scanned image.'
      });
    }

    console.log('✅ Resume parsed:', resumeText.length, 'characters');
    console.log('📊 Calculating ATS score...');
    const { totalScore, breakdown } = calculateATSScore(resumeText, jobDescription);

    console.log('💡 Generating insights...');
    const { strengths, weaknesses } = generateInsights(breakdown, resumeText, jobDescription);

    console.log('🤖 Generating AI suggestions...');
    const suggestions = await generateAISuggestions(resumeText, jobDescription, breakdown);

    console.log('✅ Analysis complete! Score:', totalScore);

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

    // Save report to file
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
      if (reports.length > 50) {
        reports.splice(50);
      }
      writeReports(reports);
      
      console.log('✅ Report saved to file');
    } catch (err) {
      console.log('⚠️ Failed to save report:', err.message);
    }

    res.json(result);

  } catch (error) {
    console.error('❌ Analyze error:', error.message);
    console.error('Stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Failed to analyze resume',
      error: error.message
    });
  }
});

// Get reports
router.get('/reports', async (req, res) => {
  try {
    console.log('📊 Fetching reports...');
    const reports = readReports();
    
    res.json({
      success: true,
      data: reports.slice(0, 10),
      total: reports.length
    });
  } catch (error) {
    console.error('❌ Reports error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reports',
      error: error.message
    });
  }
});

module.exports = router;
