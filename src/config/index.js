require('dotenv').config();
const path = require('path');

module.exports = {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'development',
  
  // Input/Output directories
  inputDir: path.resolve(__dirname, '../../input'),
  outputDir: path.resolve(__dirname, '../../output'),

  // Configurable merge order: Resume PDF has highest weight, followed by ATS JSON, Recruiter CSV, then Recruiter Notes
  mergePriority: [
    'RESUME_PDF',
    'ATS_JSON',
    'RECRUITER_CSV',
    'RECRUITER_NOTES'
  ],

  // Base confidence weights by source
  sourceConfidenceWeights: {
    RESUME_PDF: 0.95,       // High trust because candidate-authored, but extracted from text
    ATS_JSON: 0.98,         // Highest trust because structured & direct field mapping
    RECRUITER_CSV: 0.85,    // Structured but entered by third-party recruiters
    RECRUITER_NOTES: 0.65   // Unstructured and highly subjective
  },

  // Base confidence weights by extraction method
  methodConfidenceWeights: {
    DIRECT_MAPPING: 1.0,    // Pure structured direct mapping
    REGEX_MATCH: 0.90,      // Pattern match with high reliability
    HEURISTIC_EXTRACT: 0.70 // Soft heuristics/keywords
  }
};
