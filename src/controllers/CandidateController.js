const candidateTransformerService = require('../services/CandidateTransformerService');

class CandidateController {
  /**
   * Handle candidate transformation request.
   * Receives files in "files" field and optional config JSON string in "config" field.
   */
  async transform(req, res) {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          errors: ['No candidate files uploaded. Please upload source files using the "files" field name.']
        });
      }

      // Parse custom configuration if supplied, otherwise load standard default schema configuration
      let config;
      if (req.body.config) {
        try {
          config = JSON.parse(req.body.config);
        } catch (err) {
          return res.status(400).json({
            success: false,
            errors: [`Invalid config field JSON specification: ${err.message}`]
          });
        }
      } else {
        config = require('../../config.json');
      }

      // Format Multer files (using memoryStorage) for service ingestion
      const files = req.files.map(f => ({
        name: f.originalname,
        pathOrBuffer: f.buffer
      }));

      // Trigger orchestrator pipeline
      const result = await candidateTransformerService.transform(files, config);

      if (!result.success) {
        return res.status(422).json({
          success: false,
          errors: result.errors,
          data: result.data,
          provenance_audit: result.auditLog
        });
      }

      return res.status(200).json({
        success: true,
        data: result.data,
        provenance_audit: result.auditLog,
        warnings: result.errors
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        errors: [`Internal server error: ${error.message}`]
      });
    }
  }
}

module.exports = new CandidateController();
