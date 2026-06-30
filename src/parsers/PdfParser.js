const fs = require('fs').promises;
const pdf = require('pdf-parse');
const BaseParser = require('./BaseParser');

class PdfParser extends BaseParser {
  /**
   * Parse a PDF file or buffer and extract its text content.
   * @param {string|Buffer} source 
   * @param {string} sourceName 
   * @returns {Promise<{ sourceType: string, sourceName: string, rawData: string }>}
   */
  async parse(source, sourceName) {
    try {
      let buffer;
      
      if (Buffer.isBuffer(source)) {
        buffer = source;
      } else if (typeof source === 'string') {
        buffer = await fs.readFile(source);
      } else {
        throw new Error('Source must be an absolute path string or a Buffer.');
      }
      
      const parsedData = await pdf(buffer);
      
      return {
        sourceType: 'RESUME_PDF',
        sourceName,
        rawData: parsedData.text || ''
      };
    } catch (error) {
      throw new Error(`PDF Parsing failed for ${sourceName}: ${error.message}`);
    }
  }
}

module.exports = PdfParser;
