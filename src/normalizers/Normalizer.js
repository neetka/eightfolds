const { parsePhoneNumberFromString } = require('libphonenumber-js');

// Map of country names/codes to ISO Alpha-2
const COUNTRY_MAP = {
  'united states': 'US',
  'united states of america': 'US',
  'usa': 'US',
  'us': 'US',
  'united kingdom': 'GB',
  'uk': 'GB',
  'great britain': 'GB',
  'gb': 'GB',
  'india': 'IN',
  'ind': 'IN',
  'canada': 'CA',
  'can': 'CA',
  'germany': 'DE',
  'deu': 'DE',
  'france': 'FR',
  'fra': 'FR',
  'australia': 'AU',
  'aus': 'AU',
  'singapore': 'SG',
  'sg': 'SG'
};

// Map of variations to canonical skill spellings
const CANONICAL_SKILLS = {
  'js': 'JavaScript',
  'javascript': 'JavaScript',
  'ts': 'TypeScript',
  'typescript': 'TypeScript',
  'node': 'Node.js',
  'node.js': 'Node.js',
  'nodejs': 'Node.js',
  'express': 'Express',
  'expressjs': 'Express',
  'react': 'React',
  'reactjs': 'React',
  'python': 'Python',
  'golang': 'Go',
  'go': 'Go',
  'aws': 'AWS',
  'amazon web services': 'AWS',
  'docker': 'Docker',
  'kubernetes': 'Kubernetes',
  'k8s': 'Kubernetes',
  'sql': 'SQL',
  'postgres': 'PostgreSQL',
  'postgresql': 'PostgreSQL',
  'mysql': 'MySQL',
  'mongodb': 'MongoDB',
  'mongo': 'MongoDB',
  'graphql': 'GraphQL',
  'html': 'HTML',
  'css': 'CSS'
};

/**
 * Normalizes phone number to E.164.
 * Defaults to 'US' country code if none can be parsed.
 */
function normalizePhone(phoneStr, defaultCountry = 'US') {
  if (!phoneStr || typeof phoneStr !== 'string') return '';
  
  try {
    const phoneNumber = parsePhoneNumberFromString(phoneStr, defaultCountry);
    if (phoneNumber && phoneNumber.isValid()) {
      return phoneNumber.number; // E.164
    }
  } catch (err) {
    // Ignore error, fallback to digit cleaning
  }
  
  // Basic fallback: keep only digits and leading plus sign
  const cleaned = phoneStr.replace(/[^\d+]/g, '');
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

/**
 * Normalizes date strings to YYYY-MM.
 * Recognizes "Present", "Current" as "Present".
 */
function normalizeDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '';
  
  const trimmed = dateStr.trim().toLowerCase();
  if (trimmed === 'present' || trimmed === 'current' || trimmed === 'now') {
    return 'Present';
  }

  const months = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    january: '01', february: '02', march: '03', april: '04', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
  };

  // 1. Format MM/YYYY or MM-YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, '0');
    const year = slashMatch[2];
    return `${year}-${month}`;
  }

  // 2. Format YYYY-MM-DD or YYYY-MM
  const isoMatch = trimmed.match(/^(\d{4})[\/\-](\d{2})(?:[\/\-]\d{2})?$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}`;
  }

  // 3. Format containing a 4-digit year
  const yearMatch = trimmed.match(/\b(\d{4})\b/);
  if (yearMatch) {
    const year = yearMatch[1];
    
    // Find if a month keyword exists in the text
    for (const [mName, mNum] of Object.entries(months)) {
      if (trimmed.includes(mName)) {
        return `${year}-${mNum}`;
      }
    }
    // Fallback if only year is found
    return `${year}-01`;
  }

  // 4. Format of single year "YYYY"
  if (/^\d{4}$/.test(trimmed)) {
    return `${trimmed}-01`;
  }

  return dateStr; // Return raw as fallback
}

/**
 * Normalizes country in location string to ISO Alpha-2.
 */
function normalizeCountry(locationStr) {
  if (!locationStr || typeof locationStr !== 'string') return '';

  const parts = locationStr.split(',').map(p => p.trim().toLowerCase());
  const lastPart = parts[parts.length - 1];

  // Try exact match on last part (common case e.g. "San Francisco, CA, USA")
  if (COUNTRY_MAP[lastPart]) {
    return COUNTRY_MAP[lastPart];
  }

  // Look for any country name occurrence in the last part or whole string
  for (const [cName, cCode] of Object.entries(COUNTRY_MAP)) {
    if (parts.includes(cName) || lastPart.includes(cName)) {
      return cCode;
    }
  }

  return ''; // Return empty if not matched
}

/**
 * Normalizes skill name to canonical spelling.
 */
function normalizeSkill(skillStr) {
  if (!skillStr || typeof skillStr !== 'string') return '';
  
  const trimmed = skillStr.trim();
  const lower = trimmed.toLowerCase();
  
  if (CANONICAL_SKILLS[lower]) {
    return CANONICAL_SKILLS[lower];
  }

  // Title case fallback: capitalize first letter of each word
  return trimmed
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Main normalization function for a candidate object.
 */
function normalizeCandidate(candidate) {
  if (!candidate) return null;

  const defaultCountry = normalizeCountry(candidate.location) || 'US';

  const normalizedEmails = (candidate.emails || [])
    .map(e => String(e).toLowerCase().trim())
    .filter(Boolean);

  const normalizedPhones = (candidate.phones || [])
    .map(p => normalizePhone(p, defaultCountry))
    .filter(Boolean);

  const normalizedSkills = Array.from(new Set(
    (candidate.skills || [])
      .map(normalizeSkill)
      .filter(Boolean)
  ));

  const normalizedExperience = (candidate.experience || []).map(exp => ({
    title: exp.title ? String(exp.title).trim() : 'Software Engineer',
    company: exp.company ? String(exp.company).trim() : 'Company',
    startDate: normalizeDate(exp.startDate),
    endDate: normalizeDate(exp.endDate),
    description: exp.description ? String(exp.description).trim() : ''
  }));

  const normalizedEducation = (candidate.education || []).map(edu => ({
    degree: edu.degree ? String(edu.degree).trim() : 'Degree',
    school: edu.school ? String(edu.school).trim() : 'University',
    startDate: normalizeDate(edu.startDate),
    endDate: normalizeDate(edu.endDate)
  }));

  const normalizedLinks = (candidate.links || [])
    .map(l => String(l).trim())
    .filter(Boolean);

  const country = normalizeCountry(candidate.location);

  return {
    name: candidate.name ? String(candidate.name).trim() : '',
    emails: normalizedEmails,
    phones: normalizedPhones,
    skills: normalizedSkills,
    experience: normalizedExperience,
    education: normalizedEducation,
    location: candidate.location ? String(candidate.location).trim() : '',
    country: country || undefined, // Add separate ISO field if resolved
    links: normalizedLinks
  };
}

module.exports = {
  normalizePhone,
  normalizeDate,
  normalizeCountry,
  normalizeSkill,
  normalizeCandidate
};
