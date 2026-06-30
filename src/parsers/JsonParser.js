const fs = require('fs').promises;
const BaseParser = require('./BaseParser');

class JsonParser extends BaseParser {
  /**
   * Parse a JSON file or buffer.
   * @param {string|Buffer} source 
   * @param {string} sourceName 
   * @returns {Promise<{ sourceType: string, sourceName: string, rawData: Object|Array }>}
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
      
      const parsedData = JSON.parse(rawString);
      
      return {
        sourceType: 'ATS_JSON',
        sourceName,
        rawData: parsedData
      };
    } catch (error) {
      throw new Error(`JSON Parsing failed for ${sourceName}: ${error.message}`);
    }
  }
}

module.exports = JsonParser;
