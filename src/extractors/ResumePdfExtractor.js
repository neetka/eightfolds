const BaseExtractor = require('./BaseExtractor');
const {
  extractEmails,
  extractPhones,
  extractLinks,
  extractSkills,
  extractLocation,
  extractNameFromResume
} = require('../utils/textExtractorHelper');

class ResumePdfExtractor extends BaseExtractor {
  /**
   * Extract candidate information from raw PDF text.
   * @param {string} rawData - Plain text extracted from PDF.
   * @returns {Object} Standardized raw candidate object.
   */
  extract(rawData) {
    if (!rawData || typeof rawData !== 'string') {
      return this._emptyCandidate();
    }

    const name = extractNameFromResume(rawData);
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
   * Heuristically parses work experiences from resume text.
   */
  _extractExperience(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const experienceIndex = lines.findIndex(l => /^(?:work\s+)?experience|employment|history/i.test(l));
    if (experienceIndex === -1) return [];

    // Find end of experience section (next major section)
    const nextSectionIndex = lines.findIndex((l, idx) => 
      idx > experienceIndex && /^(?:education|skills|projects|certifications|links|hobbies)/i.test(l)
    );
    
    const expLines = lines.slice(experienceIndex + 1, nextSectionIndex !== -1 ? nextSectionIndex : undefined);
    
    const experiences = [];
    const dateRangeRegex = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December|\d{1,2}\/\d{4}|\d{4})[-–\s]+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December|\d{1,2}\/\d{4}|\d{4}|Present)/i;
    const yearRegex = /\b(19|20)\d{2}\b/;

    for (let i = 0; i < expLines.length; i++) {
      const line = expLines[i];
      
      if (dateRangeRegex.test(line) || yearRegex.test(line)) {
        let title = '';
        let company = '';
        let description = '';
        let startDate = '';
        let endDate = '';
        
        // Parse dates from the line
        const match = line.match(dateRangeRegex);
        if (match) {
          const parts = match[0].split(/[-–\s]+to[-–\s]+|[-–\s]+/i).filter(Boolean);
          startDate = parts[0] || '';
          endDate = parts[1] || '';
          description = line.replace(match[0], '').trim();
        }
        
        // Find title & company in preceding line or current description line
        let sourceLineForInfo = '';
        if (description.length > 5 && description.includes('at')) {
          sourceLineForInfo = description;
        } else if (i > 0) {
          sourceLineForInfo = expLines[i - 1];
        }
        
        if (sourceLineForInfo) {
          const atMatch = sourceLineForInfo.match(/(.+?)\s+at\s+(.+)/i);
          if (atMatch) {
            title = atMatch[1].replace(/^[,\s\-]+|[,\s\-]+$/g, '').trim();
            company = atMatch[2].replace(/^[,\s\-]+|[,\s\-]+$/g, '').trim();
          } else {
            const hyphenMatch = sourceLineForInfo.split(/[-–]/);
            if (hyphenMatch.length > 1) {
              company = hyphenMatch[0].trim();
              title = hyphenMatch[1].trim();
            } else {
              title = sourceLineForInfo;
            }
          }
        }
        
        // Gather subsequent lines as description
        let j = i + 1;
        while (j < expLines.length && !dateRangeRegex.test(expLines[j]) && !yearRegex.test(expLines[j])) {
          description += (description ? '\n' : '') + expLines[j];
          j++;
        }
        i = j - 1; // Advance outer loop
        
        experiences.push({
          title: title.trim() || 'Software Engineer',
          company: company.trim() || 'Company',
          startDate: startDate.trim(),
          endDate: endDate.trim(),
          description: description.trim()
        });
      }
    }

    return experiences;
  }

  /**
   * Heuristically parses education from resume text.
   */
  _extractEducation(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const educationIndex = lines.findIndex(l => /^(?:education|academic|studies)/i.test(l));
    if (educationIndex === -1) return [];

    const nextSectionIndex = lines.findIndex((l, idx) => 
      idx > educationIndex && /^(?:experience|work|skills|projects|links)/i.test(l)
    );
    
    const eduLines = lines.slice(educationIndex + 1, nextSectionIndex !== -1 ? nextSectionIndex : undefined);
    const education = [];

    for (const line of eduLines) {
      const isSchool = /university|college|school|institute/i.test(line);
      const isDegree = /(?:bachelor|master|doctor|degree|bs|ms|phd|b\.s|m\.s|b\.a|ma)\b/i.test(line);
      
      if (isSchool || isDegree) {
        const degreeMatch = line.match(/(?:bachelor|master|doctor|bs|ms|phd|b\.s|m\.s|b\.a|ma)\b[^,.\n]*/i);
        const degree = degreeMatch ? degreeMatch[0].trim() : '';
        
        let school = '';
        if (isSchool) {
          school = line.replace(degree, '').replace(/^[,\s\-]+|[,\s\-]+$/g, '').trim();
          school = school.replace(/\b(19|20)\d{2}\b/g, '').replace(/^[,\s\-]+|[,\s\-]+$/g, '').trim();
        }

        const yearMatch = line.match(/\b(19|20)\d{2}\b/g);
        const startDate = yearMatch ? yearMatch[0] : '';
        const endDate = yearMatch && yearMatch.length > 1 ? yearMatch[1] : '';

        // If we can merge with the previous entry which is missing a part
        if (education.length > 0) {
          const prev = education[education.length - 1];
          if (prev.degree && prev.school === 'University' && school && !degree) {
            prev.school = school;
            if (startDate) prev.startDate = startDate;
            if (endDate) prev.endDate = endDate;
            continue;
          }
          if (prev.school && prev.school !== 'University' && prev.degree === 'Degree' && degree && !school) {
            prev.degree = degree;
            if (startDate) prev.startDate = startDate;
            if (endDate) prev.endDate = endDate;
            continue;
          }
        }

        education.push({
          degree: degree || 'Degree',
          school: school || 'University',
          startDate: startDate || '',
          endDate: endDate || ''
        });
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

module.exports = ResumePdfExtractor;
