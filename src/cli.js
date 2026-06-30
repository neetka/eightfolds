#!/usr/bin/env node

const { Command } = require('commander');
const fs = require('fs').promises;
const path = require('path');
const candidateTransformerService = require('./services/CandidateTransformerService');

const program = new Command();

program
  .name('candidate-transformer')
  .description('Parse multiple candidate data sources (PDF, CSV, JSON, TXT) and output a canonical JSON profile.')
  .version('1.0.0')
  .argument('<files...>', 'Paths to candidate source files (e.g. resume.pdf, ats.json)')
  .option('-c, --config <path>', 'Path to configuration JSON file specifying target fields', './config.json')
  .option('-o, --output <path>', 'Output file path to save canonical JSON profile')
  .option('--no-audit', 'Exclude provenance audit trails from the output')
  .action(async (files, options) => {
    try {
      // 1. Resolve and parse configuration file
      const configPath = path.resolve(options.config);
      let configContent;
      try {
        configContent = await fs.readFile(configPath, 'utf8');
      } catch (err) {
        console.error(`Error: Configuration file not found at ${configPath}. ${err.message}`);
        process.exit(1);
      }

      let config;
      try {
        config = JSON.parse(configContent);
      } catch (err) {
        console.error(`Error: Configuration file is not valid JSON. ${err.message}`);
        process.exit(1);
      }

      // 2. Prepare file inputs
      const fileInputs = [];
      for (const filePath of files) {
        const absolutePath = path.resolve(filePath);
        try {
          await fs.access(absolutePath);
        } catch {
          console.error(`Error: Source file not found: ${filePath}`);
          process.exit(1);
        }

        fileInputs.push({
          name: path.basename(absolutePath),
          pathOrBuffer: absolutePath
        });
      }

      // 3. Trigger orchestrator service
      const result = await candidateTransformerService.transform(fileInputs, config);

      if (!result.success) {
        console.error('\nTransformation Pipeline Failed:');
        result.errors.forEach(e => console.error(`- ${e}`));
        if (result.data) {
          console.log('\nDraft/Invalid Output Structure:');
          console.log(JSON.stringify(result.data, null, 2));
        }
        process.exit(1);
      }

      // 4. Construct final output object
      const outputPayload = {
        candidate: result.data
      };

      if (options.audit !== false && result.auditLog) {
        outputPayload.provenance_audit = result.auditLog;
      }

      const formattedJson = JSON.stringify(outputPayload, null, 2);

      // 5. Save or print output
      if (options.output) {
        const outputPath = path.resolve(options.output);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, formattedJson, 'utf8');
        console.log(`Canonical candidate profile successfully written to ${outputPath}`);
      } else {
        console.log(formattedJson);
      }

      // Display non-fatal execution warnings
      if (result.errors && result.errors.length > 0) {
        console.warn('\nPipeline Warnings:');
        result.errors.forEach(w => console.warn(`- ${w}`));
      }

    } catch (error) {
      console.error(`Execution error: ${error.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
