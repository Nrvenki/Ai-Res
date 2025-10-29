const compromise = require('compromise');

// Note: HuggingFace Transformers is optional and can slow down the app
// We're using rule-based suggestions for speed

let transformersAvailable = false;
let pipeline = null;

// Try to load transformers (optional)
try {
  const transformers = require('@huggingface/transformers');
  pipeline = transformers.pipeline;
  transformersAvailable = true;
  console.log('✅ HuggingFace Transformers loaded (optional AI features enabled)');
} catch (error) {
  console.log('⚠️ HuggingFace Transformers not available - using rule-based suggestions only');
}

let summarizer = null;

// Initialize AI model (lazy loading) - Optional
const initializeAI = async () => {
  if (!transformersAvailable || !pipeline) {
    return null;
  }

  if (!summarizer) {
    try {
      console.log('🤖 Loading AI model...');
      summarizer = await pipeline('summarization', 'Xenova/distilbart-cnn-6-6');
      console.log('✅ AI model loaded');
    } catch (error) {
      console.log('⚠️ Could not load AI model:', error.message);
      return null;
    }
  }
  return summarizer;
};

// Generate AI-powered suggestions
const generateAISuggestions = async (resumeText, jobDescription, breakdown) => {
  const suggestions = [];

  try {
    // Rule-based suggestions (fast and accurate)
    const ruleBased = generateRuleBasedSuggestions(resumeText, jobDescription, breakdown);
    suggestions.push(...ruleBased);

    // AI-powered suggestions (optional - can be slow, disabled by default)
    /* Uncomment to enable AI suggestions
    try {
      const ai = await initializeAI();
      if (ai) {
        const aiSuggestions = await generateAIBasedSuggestions(resumeText, jobDescription);
        suggestions.push(...aiSuggestions);
      }
    } catch (aiError) {
      console.log('⚠️ AI suggestions unavailable, using rule-based only');
    }
    */

  } catch (error) {
    console.error('Error generating suggestions:', error);
  }

  return suggestions.slice(0, 10); // Return top 10 suggestions
};

// Rule-based suggestions (main logic)
const generateRuleBasedSuggestions = (resumeText, jobDescription, breakdown) => {
  const suggestions = [];
  const doc = compromise(resumeText);
  const jdDoc = compromise(jobDescription);

  // Extract keywords from JD
  const jdKeywords = extractImportantKeywords(jobDescription);
  const resumeLower = resumeText.toLowerCase();

  // 1. Missing Keywords
  const missingKeywords = jdKeywords.filter(keyword => 
    !resumeLower.includes(keyword.toLowerCase())
  ).slice(0, 5);

  if (missingKeywords.length > 0) {
    suggestions.push({
      category: 'Keywords',
      message: `Add these important keywords from job description: ${missingKeywords.join(', ')}`,
      priority: 'high'
    });
  }

  // 2. Formatting Issues
  if (breakdown.formatting < 70) {
    if (!resumeText.match(/experience|work history/i)) {
      suggestions.push({
        category: 'Structure',
        message: 'Add a clear "Work Experience" or "Professional Experience" section',
        priority: 'high'
      });
    }
    if (!resumeText.match(/skills|technical skills/i)) {
      suggestions.push({
        category: 'Structure',
        message: 'Include a dedicated "Skills" section with relevant technical skills',
        priority: 'high'
      });
    }
    if (!resumeText.match(/education/i)) {
      suggestions.push({
        category: 'Structure',
        message: 'Add an "Education" section with your academic qualifications',
        priority: 'medium'
      });
    }
  }

  // 3. Action Verbs
  const actionVerbs = (resumeText.match(/\b(managed|led|developed|created|implemented|designed|built|improved|achieved|delivered|coordinated|analyzed|optimized|spearheaded|executed|established)\b/gi) || []).length;
  
  if (actionVerbs < 3) {
    suggestions.push({
      category: 'Content',
      message: 'Start bullet points with strong action verbs (e.g., "Developed", "Led", "Implemented", "Optimized")',
      priority: 'medium'
    });
  }

  // 4. Quantifiable Achievements
  const numbers = (resumeText.match(/\d+%|\d+\+|increased by \d+|reduced \d+|saved \d+|\$\d+/gi) || []).length;
  
  if (numbers < 2) {
    suggestions.push({
      category: 'Content',
      message: 'Add quantifiable achievements (e.g., "Increased sales by 25%", "Reduced load time by 40%")',
      priority: 'high'
    });
  }

  // 5. ATS-Unfriendly Elements
  if (resumeText.match(/[★☆●○■□▪▫◆◇]/)) {
    suggestions.push({
      category: 'Formatting',
      message: 'Remove special characters, bullets, and symbols - use simple text only',
      priority: 'high'
    });
  }

  // 6. Personal Pronouns
  const pronouns = (resumeText.match(/\b(i|me|my|mine)\b/gi) || []).length;
  if (pronouns > 5) {
    suggestions.push({
      category: 'Writing Style',
      message: 'Avoid personal pronouns (I, me, my) - use direct action statements instead',
      priority: 'medium'
    });
  }

  // 7. Resume Length
  const wordCount = resumeText.split(/\s+/).length;
  if (wordCount < 250) {
    suggestions.push({
      category: 'Content',
      message: 'Resume is too short - aim for 400-700 words to showcase your experience',
      priority: 'medium'
    });
  } else if (wordCount > 1000) {
    suggestions.push({
      category: 'Content',
      message: 'Resume is too long - condense to 1-2 pages (500-800 words) for better readability',
      priority: 'medium'
    });
  }

  // 8. Section Headers
  if (!resumeText.match(/summary|objective/i)) {
    suggestions.push({
      category: 'Structure',
      message: 'Add a Professional Summary at the top highlighting your key qualifications',
      priority: 'medium'
    });
  }

  // 9. Contact Information
  if (!resumeText.match(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i)) {
    suggestions.push({
      category: 'Contact',
      message: 'Ensure your email address is clearly visible at the top',
      priority: 'high'
    });
  }

  if (!resumeText.match(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b|\b\(\d{3}\)\s?\d{3}[-.\s]?\d{4}\b/)) {
    suggestions.push({
      category: 'Contact',
      message: 'Include a phone number in your contact information',
      priority: 'medium'
    });
  }

  // 10. Keywords density
  if (breakdown.keywordBalance < 50) {
    suggestions.push({
      category: 'Keywords',
      message: 'Maintain 1-3% keyword density - naturally incorporate job-related terms throughout',
      priority: 'medium'
    });
  }

  // 11. Specific skill recommendations based on job description
  const jdLower = jobDescription.toLowerCase();
  
  if (jdLower.includes('react') && !resumeLower.includes('react')) {
    suggestions.push({
      category: 'Skills',
      message: 'Job requires React - add this skill if you have experience with it',
      priority: 'high'
    });
  }

  if (jdLower.includes('python') && !resumeLower.includes('python')) {
    suggestions.push({
      category: 'Skills',
      message: 'Job requires Python - add this skill if you have experience with it',
      priority: 'high'
    });
  }

  if (jdLower.includes('aws') && !resumeLower.includes('aws')) {
    suggestions.push({
      category: 'Skills',
      message: 'Job requires AWS - add cloud experience if you have it',
      priority: 'high'
    });
  }

  // 12. Certification recommendations
  if (jdLower.includes('certified') && !resumeLower.includes('certification')) {
    suggestions.push({
      category: 'Certifications',
      message: 'Add relevant certifications if you have any',
      priority: 'low'
    });
  }

  return suggestions;
};

// AI-based suggestions (optional enhancement) - Disabled by default for speed
const generateAIBasedSuggestions = async (resumeText, jobDescription) => {
  const suggestions = [];

  try {
    // Analyze resume improvement areas using AI
    const prompt = `Resume: ${resumeText.substring(0, 500)}...\n\nJob: ${jobDescription.substring(0, 300)}...`;
    
    // This is a placeholder - actual AI analysis can be added here
    suggestions.push({
      category: 'AI Insight',
      message: 'Consider tailoring your experience section to better match the job requirements',
      priority: 'low'
    });

  } catch (error) {
    console.log('AI analysis skipped');
  }

  return suggestions;
};

// Extract important keywords from job description
const extractImportantKeywords = (text) => {
  const doc = compromise(text);
  const keywords = new Set();

  // Technical skills - expanded list
  const techSkills = text.match(/\b(javascript|js|python|react|reactjs|node|nodejs|java|sql|mysql|postgresql|mongodb|aws|docker|kubernetes|k8s|git|github|gitlab|typescript|ts|express|expressjs|angular|angularjs|vue|vuejs|html|html5|css|css3|scss|sass|less|api|rest|restful|graphql|agile|scrum|kanban|ci\/cd|devops|machine learning|ml|ai|artificial intelligence|data science|cloud|azure|gcp|google cloud|tensorflow|pytorch|keras|pandas|numpy|scipy|django|flask|fastapi|spring|springboot|hibernate|maven|gradle|redis|memcached|elasticsearch|elk|jenkins|travis|circleci|ansible|puppet|chef|terraform|cloudformation|linux|unix|ubuntu|centos|bash|shell|powershell|c\+\+|cpp|c#|csharp|dotnet|ruby|rails|php|laravel|swift|kotlin|android|ios|flutter|dart|go|golang|rust|scala|perl|r|matlab|sas|spss|tableau|power bi|looker|excel|vba|word|powerpoint|jira|confluence|trello|asana|slack|teams|salesforce|dynamics|sap|oracle|peoplesoft|workday|servicenow|sharepoint|nosql|cassandra|dynamodb|couchdb|neo4j|websocket|socket\.io|microservices|serverless|lambda|azure functions|blockchain|ethereum|solidity|iot|raspberry pi|arduino|ar|vr|unity|unreal|game development|figma|sketch|adobe xd|photoshop|illustrator|after effects|premiere|ui|ux|frontend|backend|fullstack|full stack|mobile|responsive|seo|sem|analytics|gtm|tag manager|a\/b testing|conversion|oauth|jwt|authentication|authorization|security|encryption|ssl|tls|webpack|babel|npm|yarn|pnpm|testing|jest|mocha|chai|cypress|selenium|pytest|junit|tdd|bdd|design patterns|solid|dry|kiss|mvc|mvvm|redux|mobx|vuex|context api|hooks|functional programming|oop|object oriented)\b/gi);
  
  if (techSkills) {
    techSkills.forEach(skill => keywords.add(skill.toLowerCase().trim()));
  }

  // Extract nouns (potential skills/qualifications)
  doc.nouns().forEach(noun => {
    const word = noun.text().toLowerCase().trim();
    if (word.length > 3 && !word.match(/\b(with|from|that|this|have|been|were|will|would|could|should)\b/)) {
      keywords.add(word);
    }
  });

  // Soft skills
  const softSkills = text.match(/\b(leadership|communication|teamwork|problem solving|critical thinking|time management|adaptability|creativity|collaboration|organization|analytical|interpersonal|presentation|negotiation|conflict resolution|decision making|strategic thinking|project management|stakeholder management)\b/gi);
  
  if (softSkills) {
    softSkills.forEach(skill => keywords.add(skill.toLowerCase().trim()));
  }

  return Array.from(keywords).slice(0, 30);
};

module.exports = {
  generateAISuggestions
};
