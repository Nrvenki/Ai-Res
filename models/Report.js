const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  userId: {
    type: String,
    default: 'guest'
  },
  resumeText: {
    type: String,
    required: true
  },
  jobDescription: {
    type: String,
    required: true
  },
  atsScore: {
    type: Number,
    required: true
  },
  breakdown: {
    keywordMatch: Number,
    formatting: Number,
    readability: Number,
    structure: Number,
    keywordBalance: Number
  },
  suggestions: [{
    category: String,
    message: String,
    priority: String
  }],
  strengths: [String],
  weaknesses: [String],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Report', reportSchema);
