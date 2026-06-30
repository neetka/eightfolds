
const fs = require('fs').promises;
const BaseParser = require('./BaseParser');

class TxtParser extends BaseParser {
  /**
   * Parse a TXT file or buffer and extract its text content.
   * @param {string|Buffer} source 
   * @param {string} sourceName 
   * @returns {Promise<{ sourceType: string, sourceName: string, rawData: string }>}
   */
  async parse(source, sourceName) {
    try {
      let rawString;

      if (Buffer.isBuffer(source)) {
        rawString = source.toString('utf8');
      } else if (typeof source === 'string') {
        rawString = await fs.readFile(source, 'utf8');
      } else {
        throw new Error('Source must be an absolute path string or a Buffer.');
      }

      return {
        sourceType: 'RECRUITER_NOTES',
        sourceName,
        rawData: rawString
      };
    } catch (error) {
      throw new Error(`TXT Parsing failed for ${sourceName}: ${error.message}`);
    }
  }
}

module.exports = TxtParser;
