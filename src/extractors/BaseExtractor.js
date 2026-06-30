/**
 * Abstract Base Class representing an entity extractor.
 * @abstract
 */
class BaseExtractor {
  /**
   * Extract raw candidate properties from parsed data.
   * @param {any} rawData - Format-specific parsed data.
   * @returns {Object} Raw unnormalized candidate profile.
   * @abstract
   */
  extract(rawData) {
    throw new Error('Method "extract()" must be implemented by subclasses.');
  }
}

module.exports = BaseExtractor;
