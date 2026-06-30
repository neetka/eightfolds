/**
 * Abstract Base Class representing a raw data parser.
 * @abstract
 */
class BaseParser {
  /**
   * Parse the input source (file path or buffer).
   * @param {string|Buffer} source - File path or buffer to parse.
   * @param {string} sourceName - The name of the source file (e.g. 'candidate1.pdf').
   * @returns {Promise<{ sourceType: string, sourceName: string, rawData: any }>}
   * @abstract
   */
  async parse(source, sourceName) {
    throw new Error('Method "parse()" must be implemented by subclasses.');
  }
}

module.exports = BaseParser;
