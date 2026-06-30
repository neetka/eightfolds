const express = require('express');
const config = require('./src/config');
const candidateRoutes = require('./src/routes/candidate');

const app = express();

// Global Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date() });
});

// Candidate Transformation API Route
app.use('/api/candidates', candidateRoutes);

// Global Error Handler Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.stack);
  res.status(500).json({
    success: false,
    errors: [`An unexpected server error occurred: ${err.message}`]
  });
});

// Decouple listener binding from App export for integration testing using supertest
if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`Candidate Transformer Server is running in ${config.env} mode on port ${config.port}`);
  });
}

module.exports = app;
