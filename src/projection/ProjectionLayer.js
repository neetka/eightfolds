const { normalizeCountry } = require('../normalizers/Normalizer');

class ProjectionLayer {
  /**
   * Project the canonical merged profile according to the provided config.
   * @param {Object} mergedProfile - Canonical merged candidate profile.
   * @param {Object} config - Configuration object (e.g. config.json).
   * @returns {Object} Projected candidate JSON.
   */
  static project(mergedProfile, config) {
    if (!config || typeof config !== 'object') {
      throw new Error('Valid configuration object is required for projection.');
    }

    const { fields = [], on_missing = 'null' } = config;
    const projected = {};

    for (const fieldSpec of fields) {
      const { path: targetKey, from, required } = fieldSpec;
      
      // Resolve path to search for
      const sourceSelector = from || this._getFallbackSelector(targetKey);
      
      // Resolve rich field value from merged profile
      const richField = this._resolveSelector(mergedProfile, sourceSelector);

      // Check if value is missing/empty
      const isMissing = !richField || 
                        richField.value === undefined || 
                        richField.value === null || 
                        richField.value === '' ||
                        (Array.isArray(richField.value) && richField.value.length === 0);

      if (isMissing) {
        if (required) {
          if (on_missing === 'throw') {
            throw new Error(`Required field "${targetKey}" (from "${sourceSelector}") is missing.`);
          }
          projected[targetKey] = null;
          continue;
        }

        if (on_missing === 'omit') {
          continue;
        }

        projected[targetKey] = null;
        continue;
      }

      // Format field to exact schema requirements
      projected[targetKey] = this._formatField(targetKey, richField);
    }

    return projected;
  }

  static _resolveSelector(obj, selector) {
    if (!obj || !selector) return null;

    // Normalise brackets to dots: e.g. "emails[0]" -> "emails.0"
    const normalized = selector.replace(/\[(\d+)\]/g, '.$1');
    const parts = normalized.split('.').filter(Boolean);

    let current = obj;
    let lastMetadata = null;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return null;
      }

      // Step into value if currently at a metadata wrapper
      if (current.hasOwnProperty('value') && !current.hasOwnProperty(part)) {
        lastMetadata = current; // Retain parent metadata wrapper
        current = current.value;
      }

      if (current === null || current === undefined) {
        return null;
      }

      current = current[part];
    }

    // If final resolved value is already a metadata wrapper, return it
    if (current && typeof current === 'object' && current.hasOwnProperty('value') && current.hasOwnProperty('provenance')) {
      return current;
    }

    // If the leaf is inside a list of metadata wrappers
    if (Array.isArray(current) && current.length > 0 && current[0].hasOwnProperty('value')) {
      return {
        value: current,
        isWrappedArray: true
      };
    }

    if (lastMetadata) {
      return {
        value: current,
        provenance: lastMetadata.provenance,
        confidence: lastMetadata.confidence
      };
    }

    return {
      value: current,
      provenance: null,
      confidence: 0
    };
  }

  static _getFallbackSelector(key) {
    const aliases = {
      github: 'links'
    };
    return aliases[key] || key;
  }

  static _formatField(targetKey, richField) {
    const isArray = richField.isWrappedArray || Array.isArray(richField.value);
    const arr = isArray ? (richField.isWrappedArray ? richField.value : richField) : [];

    switch (targetKey) {
      case 'skills':
        return arr.map(item => item.value);
      case 'github': {
        const githubLink = arr.find(item => item.value && item.value.toLowerCase().includes('github.com'));
        return githubLink ? githubLink.value : null;
      }
      case 'experience':
        return arr.map(item => ({
          company: item.value.company || '',
          title: item.value.title || '',
          start: item.value.startDate || '',
          end: item.value.endDate || '',
          summary: item.value.description || ''
        }));
      case 'education':
        return arr.map(item => ({
          institution: item.value.school || '',
          degree: item.value.degree || '',
          field: item.value.field || '',
          end_year: item.value.endDate ? String(item.value.endDate).substring(0, 4) : ''
        }));
      case 'links': {
        const result = { linkedin: null, github: null, portfolio: null, other: [] };
        for (const item of arr) {
          const l = item.value;
          const lower = l.toLowerCase();
          if (lower.includes('linkedin.com')) result.linkedin = l;
          else if (lower.includes('github.com')) result.github = l;
          else if (lower.includes('portfolio') || lower.includes('personal')) result.portfolio = l;
          else result.other.push(l);
        }
        return result;
      }
      case 'location': {
        const val = String(richField.value || '');
        const parts = val.split(',').map(p => p.trim());
        const countryIso = normalizeCountry(val) || '';
        
        let city = parts.length > 0 ? parts[0] : '';
        let region = parts.length > 1 ? parts[1] : '';
        
        // Simple heuristic fix for parsing "Region, Country" without a city
        if (parts.length === 2 && countryIso) {
           city = '';
           region = parts[0];
        }

        return {
          city,
          region,
          country: countryIso
        };
      }
      case 'emails':
      case 'phones':
        return arr.map(item => item.value);
      default:
        // For primitive strings like full_name, candidate_id, headline, years_experience
        return richField.value;
    }
  }
}

module.exports = ProjectionLayer;
