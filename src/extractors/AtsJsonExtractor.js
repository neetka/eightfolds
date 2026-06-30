const BaseExtractor = require('./BaseExtractor');

class AtsJsonExtractor extends BaseExtractor {
  /**
   * Extract candidate fields from ATS JSON raw data.
   * @param {Object} rawData 
   * @returns {Object} Raw candidate format.
   */
  extract(rawData) {
    if (!rawData || typeof rawData !== 'object') {
      return this._emptyCandidate();
    }

    // Support common structured property name variations
    const name = rawData.name || rawData.full_name || rawData.fullName || '';
    const email = rawData.email || rawData.primary_email || rawData.emailAddress || '';
    const phone = rawData.phone || rawData.phoneNumber || rawData.mobile || '';
    const location = rawData.location || rawData.address || '';
    
    // Skills (normalize to flat string array)
    let skills = [];
    if (Array.isArray(rawData.skills)) {
      skills = rawData.skills.map(s => (s && typeof s === 'object') ? (s.name || s.skill) : s);
    } else if (typeof rawData.skills === 'string') {
      skills = rawData.skills.split(',').map(s => s.trim());
    }

    // Capture github and linkedin as links if they exist at root of ATS JSON
    let links = [];
    if (rawData.github) links.push(rawData.github);
    if (rawData.linkedin) links.push(rawData.linkedin);

    if (Array.isArray(rawData.links)) {
      links = [...links, ...rawData.links];
    } else if (typeof rawData.links === 'string') {
      links = [...links, ...rawData.links.split(',').map(l => l.trim())];
    }

    const headline = rawData.headline || '';

    // Experience mapping
    let experience = [];
    if (Array.isArray(rawData.experience)) {
      experience = rawData.experience.map(exp => ({
        title: exp.title || exp.role || exp.position || '',
        company: exp.company || exp.employer || '',
        startDate: exp.startDate || exp.start_date || exp.from || '',
        endDate: exp.endDate || exp.end_date || exp.to || '',
        description: exp.description || exp.summary || ''
      }));
    }

    // Education mapping
    let education = [];
    if (Array.isArray(rawData.education)) {
      education = rawData.education.map(edu => ({
        degree: edu.degree || edu.qualification || '',
        school: edu.school || edu.university || edu.institution || '',
        startDate: edu.startDate || edu.start_date || edu.from || '',
        endDate: edu.endDate || edu.end_date || edu.to || ''
      }));
    }

    return {
      name: typeof name === 'string' ? name.trim() : '',
      emails: email ? [String(email).trim()] : [],
      phones: phone ? [String(phone).trim()] : [],
      skills: skills.filter(s => typeof s === 'string' && s.length > 0),
      experience: experience.filter(exp => exp.title || exp.company),
      education: education.filter(edu => edu.degree || edu.school),
      location: typeof location === 'object' ? JSON.stringify(location) : String(location).trim(),
      links: links.filter(l => typeof l === 'string' && l.length > 0),
      headline: typeof headline === 'string' ? headline.trim() : ''
    };
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
      links: [],
      headline: ''
    };
  }
}

module.exports = AtsJsonExtractor;
