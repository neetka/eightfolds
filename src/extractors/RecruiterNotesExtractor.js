const BaseExtractor = require('./BaseExtractor');
const {
  extractEmails,
  extractPhones,
  extractLinks,
  extractSkills,
  extractLocation,
  extractNameFromNotes
} = require('../utils/textExtractorHelper');

class RecruiterNotesExtractor extends BaseExtractor {
  /**
   * Extract candidate information from unstructured recruiter notes (TXT).
   * @param {string} rawData - Plain text recruiter notes.
   * @returns {Object} Standardized raw candidate object.
   */
  extract(rawData) {
    if (!rawData || typeof rawData !== 'string') {
      return this._emptyCandidate();
    }

    const name = extractNameFromNotes(rawData);
    const emails = extractEmails(rawData);
    const phones = extractPhones(rawData);
    const links = extractLinks(rawData);
    const skills = extractSkills(rawData);
    const location = extractLocation(rawData);
    
    const experience = this._extractExperience(rawData);
    const education = this._extractEducation(rawData);

    return {
      name,
      emails,
      phones,
      skills,
      experience,
      education,
      location,
      links
    };
  }

  /**
   * Heuristic extraction of experience from informal notes.
   */
  _extractExperience(text) {
    const experience = [];
    
    // Look for sentences like: "Worked at Google as a Software Engineer"
    // or "Worked as a Product Manager at Apple"
    const expPatterns = [
      /worked\s+at\s+([A-Za-z0-9\s\.\,\-\_]+?)\s+as\s+(?:a|an)?\s*([A-Za-z0-9\s\.\,\-\_]+?)(?:\.|\n|for|\d)/i,
      /worked\s+as\s+(?:a|an)?\s*([A-Za-z0-9\s\.\,\-\_]+?)\s+at\s+([A-Za-z0-9\s\.\,\-\_]+?)(?:\.|\n|for|\d)/i,
      /(?:current|previous)\s+role\s*:\s*([A-Za-z0-9\s]+?)\s+at\s+([A-Za-z0-9\s]+)/i
    ];

    for (const pattern of expPatterns) {
      const match = text.match(pattern);
      if (match) {
        let title, company;
        // Depending on which pattern matched, capture groups are mapped differently
        if (pattern.source.includes('as\\s+(?:a|an)?\\s*([A-Za-z0-9\\s')) {
          company = match[1].trim();
          title = match[2].trim();
        } else {
          title = match[1].trim();
          company = match[2].trim();
        }
        
        experience.push({
          title,
          company,
          startDate: '',
          endDate: '',
          description: match[0].trim()
        });
        break; // Extract at least the primary position mentioned
      }
    }

    return experience;
  }

  /**
   * Heuristic extraction of education from informal notes.
   */
  _extractEducation(text) {
    const education = [];

    // Look for patterns like: "Graduated from MIT with a BS in CS"
    // or "Studied Computer Science at Stanford"
    const eduPatterns = [
      /(?:graduated|studied|degree)\s+(?:from|at)\s+([A-Za-z0-9\s\.\,\-\_]+?)(?:\s+with\s+(?:a|an)?\s*([A-Za-z0-9\s\.\,\-\_]+?))?(?:\.|\n|in)/i,
      /([A-Za-z\s]+)\s+degree\s+from\s+([A-Za-z0-9\s]+)/i
    ];

    for (const pattern of eduPatterns) {
      const match = text.match(pattern);
      if (match) {
        let school, degree;
        if (pattern.source.includes('degree\\s+from')) {
          degree = match[1].trim();
          school = match[2].trim();
        } else {
          school = match[1].trim();
          degree = match[2] ? match[2].trim() : 'Degree';
        }

        education.push({
          degree,
          school,
          startDate: '',
          endDate: ''
        });
        break;
      }
    }

    return education;
  }

  _emptyCandidate() {
    return {
      name: '',
      emails: [],
      phones: [],
      skills: [],
      experience: [],
      education: [],
      location: '',
      links: []
    };
  }
}

module.exports = RecruiterNotesExtractor;
