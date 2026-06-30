const config = require('../config');
const ConfidenceEngine = require('../confidence/ConfidenceEngine');

class Merger {
  /**
   * Merges multiple candidate profiles from different sources into a single canonical profile.
   * @param {Array<{ sourceType: string, sourceName: string, data: Object }>} sourceProfiles
   * @returns {Object} Merged canonical profile with provenance and confidence.
   */
  static merge(sourceProfiles) {
    if (!Array.isArray(sourceProfiles) || sourceProfiles.length === 0) {
      throw new Error('No source profiles provided for merging.');
    }

    // 1. Sort profiles by priority (highest priority first)
    const priorityOrder = config.mergePriority;
    const sortedProfiles = [...sourceProfiles].sort((a, b) => {
      const indexA = priorityOrder.indexOf(a.sourceType);
      const indexB = priorityOrder.indexOf(b.sourceType);
      // If unknown type, treat as lowest priority
      const weightA = indexA === -1 ? 999 : indexA;
      const weightB = indexB === -1 ? 999 : indexB;
      return weightA - weightB;
    });

    // 2. Prepare rich field values with confidence & provenance from each source
    const richProfiles = sortedProfiles.map(p => this._enrichProfile(p));

    // 3. Perform merge per field type
    const merged = {
      name: this._mergeSingleField(richProfiles, 'name'),
      location: this._mergeSingleField(richProfiles, 'location'),
      country: this._mergeSingleField(richProfiles, 'country'),
      headline: this._mergeSingleField(richProfiles, 'headline'),
      emails: this._mergeArrayField(richProfiles, 'emails', (a, b) => a.toLowerCase() === b.toLowerCase()),
      phones: this._mergeArrayField(richProfiles, 'phones', (a, b) => a.replace(/\D/g, '') === b.replace(/\D/g, '')),
      links: this._mergeArrayField(richProfiles, 'links', (a, b) => {
        const clean = (url) => url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/+$/, '').toLowerCase();
        return clean(a) === clean(b);
      }),
      skills: this._mergeArrayField(richProfiles, 'skills', (a, b) => a.toLowerCase().trim() === b.toLowerCase().trim()),
      experience: this._mergeExperience(richProfiles),
      education: this._mergeEducation(richProfiles)
    };

    // Calculate overall candidate confidence score
    const allFieldMetadata = [];
    const singleFields = ['name', 'location', 'country', 'headline'];
    
    singleFields.forEach(f => {
      if (merged[f] && merged[f].value) {
        allFieldMetadata.push({ confidence: merged[f].confidence });
      }
    });

    const arrayFields = ['emails', 'phones', 'links', 'skills', 'experience', 'education'];
    arrayFields.forEach(f => {
      if (Array.isArray(merged[f])) {
        merged[f].forEach(item => {
          allFieldMetadata.push({ confidence: item.confidence });
        });
      }
    });

    merged._overallConfidence = ConfidenceEngine.calculateOverallConfidence(allFieldMetadata);

    return merged;
  }

  /**
   * Enriches raw candidate data with confidence and provenance details.
   */
  static _enrichProfile(sourceProfile) {
    const { sourceType, sourceName, data } = sourceProfile;
    const enriched = {};

    for (const [field, value] of Object.entries(data)) {
      const confidence = ConfidenceEngine.calculateFieldConfidence(sourceType, field);
      const provenance = {
        source: sourceName,
        method: ConfidenceEngine.getMethodForField(sourceType, field)
      };

      if (Array.isArray(value)) {
        enriched[field] = value.map(val => ({
          value: val,
          provenance,
          confidence
        }));
      } else {
        enriched[field] = {
          value: value || null,
          provenance,
          confidence
        };
      }
    }

    return enriched;
  }

  /**
   * Merge logic for single-value fields (Name, Location, Country).
   * Picks the highest priority non-empty value.
   */
  static _mergeSingleField(richProfiles, fieldName) {
    for (const profile of richProfiles) {
      const field = profile[fieldName];
      if (field && field.value !== null && field.value !== undefined && field.value !== '') {
        return field;
      }
    }
    return { value: null, provenance: null, confidence: 0 };
  }

  /**
   * Merge logic for flat array fields (emails, phones, links, skills).
   * Combines values, deduplicates them (using custom match function),
   * and retains the occurrence with the highest confidence.
   */
  static _mergeArrayField(richProfiles, fieldName, matchFn) {
    const mergedList = [];

    for (const profile of richProfiles) {
      const items = profile[fieldName] || [];
      for (const item of items) {
        if (!item.value) continue;

        // Check if item value already exists in merged list
        const exists = mergedList.some(existing => matchFn(existing.value, item.value));
        if (!exists) {
          mergedList.push(item);
        }
      }
    }

    return mergedList;
  }

  static _mergeExperience(richProfiles) {
    const mergedList = [];

    const cleanCompany = (name) => {
      if (!name) return '';
      return name.toLowerCase()
        .replace(/\b(inc|corp|co|ltd|llc|corporation|incorporated|limited)\b/g, '')
        .replace(/[^a-z0-9]/g, '');
    };

    for (const profile of richProfiles) {
      const experiences = profile.experience || [];
      for (const exp of experiences) {
        if (!exp.value || (!exp.value.title && !exp.value.company)) continue;

        const isDuplicate = mergedList.some(existing => {
          const eVal = existing.value;
          const expVal = exp.value;
          const companyMatch = cleanCompany(eVal.company) === cleanCompany(expVal.company);
          const titleMatch = eVal.title.toLowerCase().replace(/[^a-z0-9]/g, '') ===
                             expVal.title.toLowerCase().replace(/[^a-z0-9]/g, '');
          return companyMatch && titleMatch;
        });

        if (!isDuplicate) {
          mergedList.push(exp);
        }
      }
    }

    return mergedList;
  }

  /**
   * Merge logic for education object lists.
   * Matches education items by school and degree to deduplicate.
   */
  static _mergeEducation(richProfiles) {
    const mergedList = [];

    for (const profile of richProfiles) {
      const educations = profile.education || [];
      for (const edu of educations) {
        if (!edu.value || (!edu.value.school && !edu.value.degree)) continue;

        const isDuplicate = mergedList.some(existing => {
          const eVal = existing.value;
          const eduVal = edu.value;
          const schoolMatch = eVal.school.toLowerCase().replace(/[^a-z0-9]/g, '') ===
                              eduVal.school.toLowerCase().replace(/[^a-z0-9]/g, '');
          const degreeMatch = eVal.degree.toLowerCase().replace(/[^a-z0-9]/g, '') ===
                              eduVal.degree.toLowerCase().replace(/[^a-z0-9]/g, '');
          return schoolMatch && degreeMatch;
        });

        if (!isDuplicate) {
          mergedList.push(edu);
        }
      }
    }

    return mergedList;
  }
}

module.exports = Merger;
