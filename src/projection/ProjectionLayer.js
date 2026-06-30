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

    const { fields = [], include_confidence = true, include_provenance = true, on_missing = 'null' } = config;
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
          // Otherwise, we map it to null or empty for now and let the validator catch it
          projected[targetKey] = this._formatField({ value: null }, include_confidence, include_provenance);
          continue;
        }

        if (on_missing === 'omit') {
          continue;
        }

        projected[targetKey] = this._formatField({ value: null }, include_confidence, include_provenance);
        continue;
      }

      // Format field with confidence/provenance depending on config
      projected[targetKey] = this._formatField(richField, include_confidence, include_provenance);
    }

    return projected;
  }

  /**
   * Evaluates path selectors (e.g. "emails[0]", "experience[0].company") on the merged profile.
   * Properly resolves nested structures and inherits parent metadata if accessing subfields.
   */
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
        lastMetadata = current; // Retain parent metadata wrapper (for provenance inheritance)
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

    // If the leaf is inside a list of metadata wrappers (e.g. we mapped skills array)
    if (Array.isArray(current) && current.length > 0 && current[0].hasOwnProperty('value')) {
      return {
        value: current, // Return array of rich objects
        isWrappedArray: true
      };
    }

    // If we traversed through a metadata wrapper (e.g. experience[0].company), inherit its provenance
    if (lastMetadata) {
      return {
        value: current,
        provenance: lastMetadata.provenance,
        confidence: lastMetadata.confidence
      };
    }

    // Otherwise, return it wrapped in default metadata
    return {
      value: current,
      provenance: null,
      confidence: 0
    };
  }

  /**
   * Formats the output field depending on config settings.
   */
  static _formatField(richField, includeConfidence, includeProvenance) {
    // If it's an array of rich fields (like skills, emails, etc.)
    if (richField.isWrappedArray || Array.isArray(richField.value)) {
      const arr = richField.isWrappedArray ? richField.value : richField;
      
      // If no metadata requested, return flat primitive list
      if (!includeConfidence && !includeProvenance) {
        return arr.map(item => item.value);
      }

      // Otherwise format each item in the array
      return arr.map(item => {
        const formatted = { value: item.value };
        if (includeConfidence) formatted.confidence = item.confidence;
        if (includeProvenance && item.provenance) {
          formatted.provenance = {
            source: item.provenance.source,
            method: item.provenance.method
          };
        }
        return formatted;
      });
    }

    // If metadata is disabled, return flat value
    if (!includeConfidence && !includeProvenance) {
      return richField.value;
    }

    // Format single field
    const formatted = { value: richField.value };
    if (includeConfidence) {
      formatted.confidence = richField.confidence !== undefined ? richField.confidence : 0;
    }
    if (includeProvenance) {
      formatted.provenance = richField.provenance
        ? { source: richField.provenance.source, method: richField.provenance.method }
        : null;
    }

    return formatted;
  }

  /**
   * Maps common field names when an explicit "from" selector is missing.
   */
  static _getFallbackSelector(key) {
    const aliases = {
      full_name: 'name',
      fullName: 'name',
      primary_email: 'emails[0]',
      primary_phone: 'phones[0]',
      primary_link: 'links[0]'
    };
    return aliases[key] || key;
  }
}

module.exports = ProjectionLayer;
