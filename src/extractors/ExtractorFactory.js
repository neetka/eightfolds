const AtsJsonExtractor = require('./AtsJsonExtractor');
const RecruiterCsvExtractor = require('./RecruiterCsvExtractor');
const ResumePdfExtractor = require('./ResumePdfExtractor');
const RecruiterNotesExtractor = require('./RecruiterNotesExtractor');

class ExtractorFactory {
  /**
   * Resolve and return the correct Extractor subclass based on source type.
   * @param {string} sourceType 
   * @returns {import('./BaseExtractor')} Extractor instance.
   */
  static getExtractor(sourceType) {
    switch (sourceType) {
      case 'ATS_JSON':
        return new AtsJsonExtractor();
      case 'RECRUITER_CSV':
        return new RecruiterCsvExtractor();
      case 'RESUME_PDF':
        return new ResumePdfExtractor();
      case 'RECRUITER_NOTES':
        return new RecruiterNotesExtractor();
      default:
        throw new Error(`Unsupported source type for extraction: ${sourceType}`);
    }
  }
}

module.exports = ExtractorFactory;
