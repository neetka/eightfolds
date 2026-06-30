const ParserFactory = require('../parsers/ParserFactory');
const ExtractorFactory = require('../extractors/ExtractorFactory');
const { normalizeCandidate } = require('../normalizers/Normalizer');
const Merger = require('../merger/Merger');
const ProjectionLayer = require('../projection/ProjectionLayer');
const Validator = require('../validator/Validator');
const ProvenanceTracker = require('../provenance/ProvenanceTracker');

class CandidateTransformerService {
  /**
   * Process multiple raw source files and produce a single canonical candidate profile.
   * @param {Array<{ name: string, pathOrBuffer: string|Buffer }>} files - List of input files.
   * @param {Object} projectionConfig - Projection and validation configuration.
   * @returns {Promise<{ success: boolean, data?: Object, auditLog?: Array<Object>, errors?: Array<string> }>}
   */
  async transform(files, projectionConfig) {
    if (!Array.isArray(files) || files.length === 0) {
      return {
        success: false,
        errors: ['No input files provided.']
      };
    }

    if (!projectionConfig || typeof projectionConfig !== 'object') {
      return {
        success: false,
        errors: ['Invalid or missing projection configuration.']
      };
    }

    const normalizedProfiles = [];
    const errors = [];

    // 1. Ingestion Phase: Parse, extract, and normalize each source file in isolation
    for (const file of files) {
      try {
        const parser = ParserFactory.getParser(file.name);
        const parsed = await parser.parse(file.pathOrBuffer, file.name);

        const extractor = ExtractorFactory.getExtractor(parsed.sourceType);
        const extracted = extractor.extract(parsed.rawData);

        const normalized = normalizeCandidate(extracted);

        normalizedProfiles.push({
          sourceType: parsed.sourceType,
          sourceName: parsed.sourceName,
          data: normalized
        });
      } catch (err) {
        // Collect errors for individual file failures without crashing the entire pipeline
        errors.push(`File "${file.name}" processing error: ${err.message}`);
      }
    }

    // If no profiles were successfully ingested, abort
    if (normalizedProfiles.length === 0) {
      return {
        success: false,
        errors: ['All source files failed to ingest.', ...errors]
      };
    }

    try {
      // 2. Integration Phase: Merge duplicate candidate information & resolve conflicts
      const mergedProfile = Merger.merge(normalizedProfiles);

      // 3. Provenance Tracking Phase: Generate flat audit trail
      const auditLog = ProvenanceTracker.getAuditLog(mergedProfile);

      // 4. Projection Phase: Shape output JSON format
      const projected = ProjectionLayer.project(mergedProfile, projectionConfig);

      // 5. Validation Phase: Dynamic schema validation using Zod
      const validationResult = Validator.validate(projected, projectionConfig);

      if (!validationResult.success) {
        return {
          success: false,
          errors: [...errors, ...validationResult.errors],
          data: projected, // Return projected data so the client can inspect it
          auditLog
        };
      }

      // Success
      return {
        success: true,
        data: validationResult.data,
        auditLog,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (pipelineErr) {
      return {
        success: false,
        errors: [...errors, `Pipeline execution crashed: ${pipelineErr.message}`]
      };
    }
  }
}

module.exports = new CandidateTransformerService();
