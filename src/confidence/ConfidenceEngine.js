const config = require('../config');

class ConfidenceEngine {
  /**
   * Determine the extraction method for a candidate field based on source structure.
   * @param {string} sourceType - e.g. 'RESUME_PDF', 'ATS_JSON', 'RECRUITER_CSV', 'RECRUITER_NOTES'
   * @param {string} fieldName - e.g. 'name', 'emails', 'phones'
   * @returns {string} Method weight key: 'DIRECT_MAPPING', 'REGEX_MATCH', or 'HEURISTIC_EXTRACT'
   */
  static getMethodForField(sourceType, fieldName) {
    if (sourceType === 'ATS_JSON' || sourceType === 'RECRUITER_CSV') {
      return 'DIRECT_MAPPING';
    }

    // Unstructured text sources use regex for patterns, heuristics for other text blocks
    const regexFields = ['emails', 'phones', 'links'];
    if (regexFields.includes(fieldName)) {
      return 'REGEX_MATCH';
    }
    
    return 'HEURISTIC_EXTRACT';
  }

  /**
   * Calculate confidence score for a field based on source and method.
   * @param {string} sourceType 
   * @param {string} fieldName 
   * @returns {number} Score between 0.00 and 1.00.
   */
  static calculateFieldConfidence(sourceType, fieldName) {
    const sourceWeight = config.sourceConfidenceWeights[sourceType] || 0.50;
    const method = this.getMethodForField(sourceType, fieldName);
    const methodWeight = config.methodConfidenceWeights[method] || 0.50;

    const rawScore = sourceWeight * methodWeight;
    return Math.round((rawScore + Number.EPSILON) * 100) / 100;
  }

  /**
   * Calculates a summary confidence score for the entire candidate profile.
   * Uses a simple average of confidence scores of all populated fields.
   * @param {Array<Object>} fieldMetadataList - List of merged fields and their confidence.
   * @returns {number} Average confidence score.
   */
  static calculateOverallConfidence(fieldMetadataList) {
    if (!Array.isArray(fieldMetadataList) || fieldMetadataList.length === 0) {
      return 0.00;
    }

    const total = fieldMetadataList.reduce((sum, item) => sum + (item.confidence || 0), 0);
    return Math.round((total / fieldMetadataList.length) * 100) / 100;
  }
}

module.exports = ConfidenceEngine;
