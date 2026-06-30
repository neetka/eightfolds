const fs = require('fs');

// Common tech skills dictionary for regex-based lookup
const DEFAULT_SKILL_VOCABULARY = [
  'JavaScript', 'JS', 'TypeScript', 'TS', 'Node.js', 'Node', 'Express', 'React', 'Angular', 'Vue',
  'Python', 'Django', 'Flask', 'Java', 'Spring', 'C++', 'C#', 'Ruby', 'Rails', 'Go', 'Golang',
  'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'NoSQL', 'Redis', 'AWS', 'Azure', 'GCP', 'Docker',
  'Kubernetes', 'Git', 'HTML', 'CSS', 'GraphQL', 'REST API'
];

/**
 * Extract emails from a block of text.
 * @param {string} text 
 * @returns {Array<string>} Array of emails.
 */
function extractEmails(text) {
  if (!text) return [];
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return Array.from(new Set(text.match(emailRegex) || [])).map(e => e.trim());
}

/**
 * Extract phone numbers from a block of text.
 * @param {string} text 
 * @returns {Array<string>} Array of phones.
 */
function extractPhones(text) {
  if (!text) return [];
  // Matches various formats: +1 (555) 555-5555, 555-555-5555, etc.
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  return Array.from(new Set(text.match(phoneRegex) || [])).map(p => p.trim());
}

/**
 * Extract URLs from a block of text.
 * @param {string} text 
 * @returns {Array<string>} Array of URLs.
 */
function extractLinks(text) {
  if (!text) return [];
  // Match URLs with or without http/https protocol prefix
  const urlRegex = /(?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)/g;
  const matches = text.match(urlRegex) || [];
  
  // Filter out emails and ensure it contains a domain dot
  const cleaned = matches
    .map(m => m.trim())
    .filter(m => !m.includes('@') && m.includes('.'));
    
  return Array.from(new Set(cleaned)).map(l => {
    if (!/^https?:\/\//i.test(l)) {
      return `http://${l}`;
    }
    return l;
  });
}

/**
 * Extract matched skills from a block of text based on vocabulary list.
 * @param {string} text 
 * @param {Array<string>} [vocab] 
 * @returns {Array<string>} Array of matched skills.
 */
function extractSkills(text, vocab = DEFAULT_SKILL_VOCABULARY) {
  if (!text) return [];
  const foundSkills = [];
  
  vocab.forEach(skill => {
    // Escape special characters in skill name for safe regex creation (e.g. Node.js, C++)
    const escapedSkill = skill.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    // Ensure word boundaries or distinct usage (e.g. JS, C++)
    // If skill ends/starts with special chars, boundary requirements differ
    let regexStr = `\\b${escapedSkill}\\b`;
    if (escapedSkill.endsWith('+') || escapedSkill.endsWith('.')) {
      regexStr = `\\b${escapedSkill}`;
    }
    if (escapedSkill.startsWith('+') || escapedSkill.startsWith('.')) {
      regexStr = `${escapedSkill}\\b`;
    }
    
    const regex = new RegExp(regexStr, 'gi');
    if (regex.test(text)) {
      foundSkills.push(skill);
    }
  });

  return foundSkills;
}

/**
 * Extract location from text based on common patterns.
 * @param {string} text 
 * @returns {string} Location string or empty.
 */
function extractLocation(text) {
  if (!text) return '';
  
  // Look for patterns like "Location: San Francisco, CA" or "Address: New York"
  const locationPatterns = [
    /(?:location|address|lives in|based in)\s*:\s*([^\n\r,]+(?:,\s*[A-Z]{2})?(?:,\s*[A-Za-z\s]+)?)/i,
    /(?:location|address|lives in|based in)\s+([^\n\r,]+(?:,\s*[A-Z]{2})?(?:,\s*[A-Za-z\s]+)?)/i
  ];

  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return '';
}

/**
 * Heuristically extracts a candidate name from a resume.
 * @param {string} text 
 * @returns {string} Name or empty.
 */
function extractNameFromResume(text) {
  if (!text) return '';
  
  // Split into lines and look at first few lines
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  
  // Exclude lines with email/phone symbols or too long/short
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i];
    
    // Ignore lines containing emails or numbers (phone/address)
    if (line.includes('@') || /\d/.test(line)) continue;
    
    // Ignore section headers
    if (/experience|education|skills|summary|profile|about|contact/i.test(line)) continue;
    
    // Typically a candidate name is 2-3 words
    const words = line.split(/\s+/);
    if (words.length >= 2 && words.length <= 4) {
      return line;
    }
  }
  
  return '';
}

/**
 * Heuristically extracts candidate name from Recruiter Notes text.
 * @param {string} text 
 * @returns {string} Name or empty.
 */
function extractNameFromNotes(text) {
  if (!text) return '';

  const namePatterns = [
    /(?:candidate|name|discussed with|profile of)\s*:\s*([A-Za-z \t]{2,30})/i,
    /(?:candidate|name|discussed with|profile of)\s+([A-Za-z \t]{2,30})/i
  ];

  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // Fallback to name heuristic for resumes
  return extractNameFromResume(text);
}

module.exports = {
  extractEmails,
  extractPhones,
  extractLinks,
  extractSkills,
  extractLocation,
  extractNameFromResume,
  extractNameFromNotes,
  DEFAULT_SKILL_VOCABULARY
};
