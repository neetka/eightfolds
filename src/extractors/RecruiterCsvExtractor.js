const BaseExtractor = require('./BaseExtractor');

class RecruiterCsvExtractor extends BaseExtractor {
  /**
   * Extract candidate fields from Recruiter CSV raw data.
   * @param {Array<Object>} rawData - Array of rows.
   * @returns {Object} Raw candidate format.
   */
  extract(rawData) {
    if (!Array.isArray(rawData) || rawData.length === 0) {
      return this._emptyCandidate();
    }

    // Extract the candidate from the first row
    const row = rawData[0];

    const name = row.name || row.full_name || row.fullName || row.candidate_name || '';
    const email = row.email || row.primary_email || row.contact_email || '';
    const phone = row.phone || row.phone_number || row.mobile || '';
    const location = row.location || row.address || row.country || '';

    // Skills: split by comma if present
    let skills = [];
    const skillsField = row.skills || row.key_skills || row.tags || '';
    if (skillsField) {
      skills = String(skillsField).split(',').map(s => s.trim());
    }

    // Links: split by comma if present
    let links = [];
    const linksField = row.links || row.urls || row.portfolio || '';
    if (linksField) {
      links = String(linksField).split(',').map(l => l.trim());
    }

    // Experience: flat fields
    let experience = [];
    const title = row.title || row.current_title || row.role || '';
    const company = row.company || row.current_company || row.employer || '';
    if (title || company) {
      experience.push({
        title: String(title).trim(),
        company: String(company).trim(),
        startDate: row.experience_start_date || row.start_date || '',
        endDate: row.experience_end_date || row.end_date || '',
        description: row.experience_description || ''
      });
    }

    // Education: flat fields
    let education = [];
    const degree = row.degree || row.education_degree || '';
    const school = row.school || row.university || row.institution || '';
    if (degree || school) {
      education.push({
        degree: String(degree).trim(),
        school: String(school).trim(),
        startDate: row.education_start_date || '',
        endDate: row.education_end_date || ''
      });
    }

    return {
      name: String(name).trim(),
      emails: email ? [String(email).trim()] : [],
      phones: phone ? [String(phone).trim()] : [],
      skills: skills.filter(s => s.length > 0),
      experience,
      education,
      location: String(location).trim(),
      links: links.filter(l => l.length > 0)
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
      links: []
    };
  }
}

module.exports = RecruiterCsvExtractor;
