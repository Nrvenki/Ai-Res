const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const parseResume = async (file) => {
  try {
    const fileType = file.mimetype;
    let text = '';

    if (fileType === 'application/pdf') {
      const dataBuffer = file.buffer;
      // pdf-parse takes a buffer directly
      const data = await pdfParse(dataBuffer);
      text = data.text;
    } else if (
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileType === 'application/msword'
    ) {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      text = result.value;
    } else {
      throw new Error('Unsupported file format. Please upload PDF or DOCX.');
    }

    // Clean the text
    text = text
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();

    if (!text || text.length < 50) {
      throw new Error('Could not extract enough text. Please ensure the PDF contains readable text, not scanned images.');
    }

    return text;
  } catch (error) {
    console.error('Parse error:', error);
    throw new Error(`Failed to parse resume: ${error.message}`);
  }
};

const extractSections = (text) => {
  const sections = {
    contact: '',
    summary: '',
    experience: '',
    education: '',
    skills: '',
    certifications: '',
    hasExperience: false,
    hasEducation: false,
    hasSkills: false
  };

  const lowerText = text.toLowerCase();

  // Simple section detection
  const experienceMatch = lowerText.match(/experience|work history|employment/i);
  const educationMatch = lowerText.match(/education|academic|qualification/i);
  const skillsMatch = lowerText.match(/skills|technical skills|competencies/i);

  if (experienceMatch) {
    sections.hasExperience = true;
  }
  if (educationMatch) {
    sections.hasEducation = true;
  }
  if (skillsMatch) {
    sections.hasSkills = true;
  }

  return sections;
};

module.exports = {
  parseResume,
  extractSections
};
