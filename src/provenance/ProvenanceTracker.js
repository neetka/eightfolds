class ProvenanceTracker {
  /**
   * Generate an audit log listing the source and method for all candidate fields.
   * @param {Object} mergedProfile - Canonical candidate profile with metadata.
   * @returns {Array<Object>} List of provenance audit entries.
   */
  static getAuditLog(mergedProfile) {
    if (!mergedProfile || typeof mergedProfile !== 'object') {
      return [];
    }

    const log = [];

    for (const [field, data] of Object.entries(mergedProfile)) {
      // Skip internal metadata fields (e.g. starting with '_')
      if (field.startsWith('_')) continue;

      if (Array.isArray(data)) {
        data.forEach(item => {
          log.push({
            field,
            value: item.value,
            source: item.provenance ? item.provenance.source : 'UNKNOWN',
            method: item.provenance ? item.provenance.method : 'UNKNOWN',
            confidence: item.confidence || 0.00
          });
        });
      } else if (data && typeof data === 'object') {
        log.push({
          field,
          value: data.value,
          source: data.provenance ? data.provenance.source : 'UNKNOWN',
          method: data.provenance ? data.provenance.method : 'UNKNOWN',
          confidence: data.confidence || 0.00
        });
      }
    }

    return log;
  }
}

module.exports = ProvenanceTracker;
