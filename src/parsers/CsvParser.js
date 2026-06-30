const csv = require('csv-parser');
const BaseParser = require('./BaseParser');
const { getReadableStream } = require('../utils/stream');

class CsvParser extends BaseParser {
  /**
   * Parse a CSV file or buffer into an array of row objects.
   * @param {string|Buffer} source 
   * @param {string} sourceName 
   * @returns {Promise<{ sourceType: string, sourceName: string, rawData: Array<Object> }>}
   */
  async parse(source, sourceName) {
    return new Promise((resolve, reject) => {
      const results = [];
      try {
        const stream = getReadableStream(source);
        
        stream
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', () => {
            resolve({
              sourceType: 'RECRUITER_CSV',
              sourceName,
              rawData: results
            });
          })
          .on('error', (error) => {
            reject(new Error(`CSV Parsing failed for ${sourceName}: ${error.message}`));
          });
      } catch (err) {
        reject(new Error(`CSV Parsing initialization failed for ${sourceName}: ${err.message}`));
      }
    });
  }
}

module.exports = CsvParser;
