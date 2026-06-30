const CsvParser = require('./CsvParser');
const JsonParser = require('./JsonParser');
const PdfParser = require('./PdfParser');
const TxtParser = require('./TxtParser');

class ParserFactory {
  /**
   * Get the appropriate parser based on file name extension.
   * @param {string} fileName - Name of the file (e.g. 'resume.pdf')
   * @returns {import('./BaseParser')} Instance of parser.
   */
  static getParser(fileName) {
    if (!fileName || typeof fileName !== 'string') {
      throw new Error('Valid filename is required to determine parser type.');
    }

    const ext = fileName.split('.').pop().toLowerCase();
    
    switch (ext) {
      case 'csv':
        return new CsvParser();
      case 'json':
        return new JsonParser();
      case 'pdf':
        return new PdfParser();
      case 'txt':
        return new TxtParser();
      default:
        throw new Error(`Unsupported file extension: .${ext}`);
    }
  }
}

module.exports = ParserFactory;
