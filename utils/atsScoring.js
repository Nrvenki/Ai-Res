const natural = require('natural');
const compromise = require('compromise');

const tokenizer = new natural.WordTokenizer();
const TfIdf = natural.TfIdf;

// Main ATS Scoring Function
const calculateATSScore = (resumeText, jobDescription) => {
  try {
    // 1. Keyword Match Score (40%)
    const keywordMatchScore = calculateKeywordMatch(resumeText, jobDescription);

    // 2. Formatting & Sections Score (20%)
    const formattingScore = calculateFormattingScore(resumeText);

    // 3. Grammar & Readability Score (15%)
    const readabilityScore = calculateReadabilityScore(resumeText);

    // 4. ATS-Friendly Structure Score (15%)
    const structureScore = calculateStructureScore(resumeText);

    // 5. Word Count & Keyword Balance Score (10%)
    const balanceScore = calculateBalanceScore(resumeText, jobDescription);

    // Calculate weighted total
    const totalScore = Math.round(
      keywordMatchScore * 0.4 +
      formattingScore * 0.2 +
      readabilityScore * 0.15 +
      structureScore * 0.15 +
      balanceScore * 0.1
    );

    return {
      totalScore: Math.min(100, Math.max(0, totalScore)),
      breakdown: {
        keywordMatch: Math.round(keywordMatchScore),
        formatting: Math.round(formattingScore),
        readability: Math.round(readabilityScore),
        structure: Math.round(structureScore),
        keywordBalance: Math.round(balanceScore)
      }
    };
  } catch (error) {
    console.error('Error calculating ATS score:', error);
    return {
      totalScore: 0,
      breakdown: {
        keywordMatch: 0,
        formatting: 0,
        readability: 0,
        structure: 0,
        keywordBalance: 0
      }
    };
  }
};

// 1. Keyword Matching (40%)
const calculateKeywordMatch = (resumeText, jobDescription) => {
  const tfidf = new TfIdf();
  tfidf.addDocument(resumeText.toLowerCase());
  tfidf.addDocument(jobDescription.toLowerCase());

  // Extract important keywords from JD
  const jdKeywords = extractKeywords(jobDescription);
  const resumeKeywords = extractKeywords(resumeText);

  let matchCount = 0;
  const totalKeywords = jdKeywords.length;

  jdKeywords.forEach((keyword) => {
    if (resumeKeywords.includes(keyword)) {
      matchCount++;
    }
  });

  // Check for skill variations
  const matchPercentage = totalKeywords > 0 ? (matchCount / totalKeywords) * 100 : 0;
  
  return Math.min(100, matchPercentage);
};

// Extract keywords using NLP
const extractKeywords = (text) => {
  const doc = compromise(text);
  
  // Extract nouns, skills, and technical terms
  const keywords = new Set();
  
  // Get nouns and proper nouns
  doc.nouns().forEach(noun => {
    keywords.add(noun.text().toLowerCase());
  });

  // Common tech skills patterns
  const techSkills = text.toLowerCase().match(/\b(javascript|python|react|node|nodejs|java|sql|mysql|postgresql|mongodb|aws|docker|kubernetes|git|typescript|express|angular|vue|html|css|scss|sass|api|restful|graphql|agile|scrum|ci\/cd|devops|machine learning|ml|ai|data science|cloud|azure|gcp|tensorflow|pytorch|pandas|numpy|django|flask|spring|hibernate|redis|elasticsearch|jenkins|ansible|terraform|linux|unix|bash|powershell|c\+\+|c#|ruby|php|swift|kotlin|go|rust|scala|perl|r|matlab|sas|tableau|power bi|excel|word|jira|confluence|salesforce|sap|oracle|nosql|websocket|microservices|serverless|blockchain|iot|ar|vr|unity|unreal|figma|sketch|photoshop|illustrator|xd)\b/gi);
  
  if (techSkills) {
    techSkills.forEach(skill => keywords.add(skill.toLowerCase()));
  }

  return Array.from(keywords);
};

// 2. Formatting & Sections Score (20%)
const calculateFormattingScore = (resumeText) => {
  let score = 0;

  const sections = [
    /contact|email|phone/i,
    /summary|objective|profile/i,
    /experience|work history|employment/i,
    /education|academic|degree/i,
    /skills|technical skills|competencies/i
  ];

  sections.forEach((regex) => {
    if (regex.test(resumeText)) {
      score += 20;
    }
  });

  // Check for proper length
  const wordCount = resumeText.split(/\s+/).length;
  if (wordCount >= 300 && wordCount <= 800) {
    score += 20;
  } else if (wordCount > 200) {
    score += 10;
  }

  return Math.min(100, score);
};

// 3. Grammar & Readability Score (15%)
const calculateReadabilityScore = (resumeText) => {
  let score = 100;

  // Check for excessive use of personal pronouns (I, me, my)
  const pronounCount = (resumeText.match(/\b(i|me|my|mine)\b/gi) || []).length;
  const words = resumeText.split(/\s+/).length;
  const pronounRatio = pronounCount / words;

  if (pronounRatio > 0.05) {
    score -= 30;
  } else if (pronounRatio > 0.02) {
    score -= 15;
  }

  // Check sentence structure
  const sentences = resumeText.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const avgSentenceLength = words / Math.max(sentences.length, 1);

  if (avgSentenceLength > 25) {
    score -= 20; // Too complex
  } else if (avgSentenceLength < 10) {
    score -= 10; // Too simple
  }

  // Check for action verbs
  const actionVerbs = (resumeText.match(/\b(managed|led|developed|created|implemented|designed|built|improved|achieved|delivered|coordinated|analyzed|optimized|spearheaded|executed|established|initiated|launched|streamlined|enhanced|resolved|maintained|supervised|trained|mentored|collaborated|facilitated|negotiated|increased|reduced|transformed|automated|integrated|tested|debugged|deployed|architected|engineered|programmed|coded)\b/gi) || []).length;
  
  if (actionVerbs >= 5) {
    score += 20;
  } else if (actionVerbs >= 3) {
    score += 10;
  }

  return Math.max(0, Math.min(100, score));
};

// 4. ATS-Friendly Structure Score (15%)
const calculateStructureScore = (resumeText) => {
  let score = 100;

  // Penalize if contains special characters or symbols
  const specialChars = (resumeText.match(/[★☆●○■□▪▫◆◇]/g) || []).length;
  if (specialChars > 0) {
    score -= 30;
  }

  // Check for table indicators (multiple tabs or aligned columns)
  const tabs = (resumeText.match(/\t/g) || []).length;
  if (tabs > 10) {
    score -= 20;
  }

  // Check for proper date formats
  const dateFormats = (resumeText.match(/\b\d{4}\b|\b\d{1,2}\/\d{4}\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}\b/gi) || []).length;
  
  if (dateFormats >= 2) {
    score += 10;
  }

  return Math.max(0, Math.min(100, score));
};

// 5. Word Count & Keyword Balance Score (10%)
const calculateBalanceScore = (resumeText, jobDescription) => {
  const resumeWords = resumeText.split(/\s+/).length;
  const jdKeywords = extractKeywords(jobDescription);
  const resumeTextLower = resumeText.toLowerCase();

  let keywordFrequency = 0;
  jdKeywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = (resumeTextLower.match(regex) || []).length;
    keywordFrequency += matches;
  });

  // Ideal: 1-3% keyword density
  const keywordDensity = resumeWords > 0 ? (keywordFrequency / resumeWords) * 100 : 0;

  let score = 100;

  if (keywordDensity < 1) {
    score = 50; // Too few keywords
  } else if (keywordDensity > 5) {
    score = 40; // Keyword stuffing
  } else if (keywordDensity >= 1 && keywordDensity <= 3) {
    score = 100; // Perfect balance
  } else {
    score = 70;
  }

  // Check word count
  if (resumeWords < 250) {
    score -= 30;
  } else if (resumeWords > 1000) {
    score -= 20;
  }

  return Math.max(0, score);
};

// Generate Strengths and Weaknesses
const generateInsights = (breakdown, resumeText, jobDescription) => {
  const strengths = [];
  const weaknesses = [];

  // Keyword Match Analysis
  if (breakdown.keywordMatch >= 70) {
    strengths.push('Excellent keyword alignment with job description');
  } else if (breakdown.keywordMatch < 50) {
    weaknesses.push('Low keyword match - add more relevant skills and terms from job description');
  }

  // Formatting Analysis
  if (breakdown.formatting >= 80) {
    strengths.push('Well-structured resume with all essential sections');
  } else if (breakdown.formatting < 60) {
    weaknesses.push('Missing key sections like Summary, Experience, or Skills');
  }

  // Readability Analysis
  if (breakdown.readability >= 75) {
    strengths.push('Clear and professional writing style with strong action verbs');
  } else if (breakdown.readability < 60) {
    weaknesses.push('Improve sentence structure and use more action verbs');
  }

  // Structure Analysis
  if (breakdown.structure >= 80) {
    strengths.push('ATS-friendly format without complex tables or special characters');
  } else if (breakdown.structure < 60) {
    weaknesses.push('Avoid using tables, graphics, or special symbols');
  }

  // Balance Analysis
  if (breakdown.keywordBalance >= 70) {
    strengths.push('Optimal keyword density and resume length');
  } else if (breakdown.keywordBalance < 50) {
    weaknesses.push('Adjust keyword usage - either too sparse or stuffed');
  }

  return { strengths, weaknesses };
};

module.exports = {
  calculateATSScore,
  generateInsights
};
