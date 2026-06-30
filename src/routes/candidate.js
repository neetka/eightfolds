const express = require('express');
const multer = require('multer');
const candidateController = require('../controllers/CandidateController');

const router = express.Router();

// Multer configuration: Store files in memory buffer for pipeline ingestion
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max per file
    files: 5 // Limit batch to 5 files
  }
});

// Endpoint: POST /api/candidates/transform
router.post('/transform', upload.array('files', 5), (req, res) => {
  return candidateController.transform(req, res);
});

module.exports = router;
