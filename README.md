# Multi-Source Candidate Data Transformer

A production-grade, modular Node.js ETL pipeline that ingests candidate data from multiple structured (CSV, JSON) and unstructured (PDF Resumes, TXT Recruiter Notes) sources, merges duplicate information using a deterministic priority hierarchy, assigns field-level confidence scores, tracks data provenance, and outputs a runtime-configurable projected JSON validated with Zod.

---

## Architecture Design

This system is built following **Clean Architecture** and **SOLID principles**. The processing pipeline is structured as an isolated Pipe-and-Filter flow:

```
[Input Sources] ➔ [Parser Factory] ➔ [Extractor Factory] ➔ [Normalizers] 
                ➔ [Merger & Resolver] ➔ [Confidence Engine] ➔ [Provenance Track] 
                ➔ [Projection Layer] ➔ [Dynamic Validator] ➔ [Output JSON]
```

### Key Modules

- **Parsers (`src/parsers/`)**: Isolated adapters that parse file paths or buffers into raw structured data or text streams, matching file extensions via `ParserFactory`.
- **Extractors (`src/extractors/`)**: Extracts candidate entities (Name, Emails, Phones, Skills, Experience, Education, Location, Links) using direct mapping (JSON/CSV) or regex/heuristics (PDF Resumes/TXT notes).
- **Normalizers (`src/normalizers/`)**: Sanitizes values into standardized formats:
  - Phone Numbers ➔ E.164 (using `libphonenumber-js`).
  - Dates ➔ `YYYY-MM` (interpreting "Present", relative terms, and written dates).
  - Country ➔ ISO Alpha-2 (e.g. "USA" / "United States" ➔ "US").
  - Skills ➔ Canonical skill names (e.g. "js" ➔ "JavaScript").
- **Merger (`src/merger/`)**: Resolves conflicts deterministically using the priority order:
  `Resume PDF > ATS JSON > Recruiter CSV > Recruiter Notes (TXT)`
  - *Deduplication*: Collapses matching emails/phones/skills. Deduplicates experience and education by cleaning titles and stripping corporate suffixes (such as "Inc.", "Corp.", "Ltd.").
- **Confidence Engine (`src/confidence/`)**: Computes scores using:
  `Field Confidence = Source Weight * Method Weight`
  - Floating-point calculations are corrected against binary precision rounding limits using `Number.EPSILON`.
- **Provenance Tracking (`src/provenance/`)**: Attaches an audit log to each value indicating its file source, extraction method, and confidence score.
- **Projection (`src/projection/`)**: Evaluates config-driven path selectors (e.g. `emails[0]`, `experience[0].company`) and formats output JSON, supporting metadata inheritance on nested properties.
- **Validator (`src/validator/`)**: Dynamically compiles a Zod schema matching the active projection configuration. Ensures required fields are present and handles validation errors gracefully.

---

## Technology Stack

- **Runtime**: Node.js (JavaScript, CommonJS modules)
- **Framework**: Express.js
- **Ingestion & Parsing**: `pdf-parse`, `csv-parser`, `multer`
- **Validation**: `zod`, `libphonenumber-js`
- **Testing**: `Jest`, `supertest`

---

## Installation & Setup

1. Clone the repository and navigate to the project directory:
   ```bash
   cd candidate-transformer
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run unit and integration tests:
   ```bash
   npm test
   ```

---

## CLI Usage

The system exposes a CLI tool (`src/cli.js`) to process local files.

```bash
node src/cli.js <paths_to_files...> [options]
```

### Options
- `-c, --config <path>`: Custom schema projection configuration (defaults to `./config.json`).
- `-o, --output <path>`: Write the resulting JSON to a file (prints to stdout by default).
- `--no-audit`: Exclude the provenance audit trail.

### Example
```bash
node src/cli.js ./tests/mock_resume.txt ./tests/mock_ats.json -o ./output/profile.json
```

---

## REST API Documentation

Start the Express API server:
```bash
npm start
```
The server will run on port `3000` (or the `PORT` env variable if configured).

### 1. Health Check
- **Endpoint**: `GET /health`
- **Response**: `200 OK`
  ```json
  {
    "status": "UP",
    "timestamp": "2026-06-30T13:42:00.000Z"
  }
  ```

### 2. Transform Candidates
- **Endpoint**: `POST /api/candidates/transform`
- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `files`: Upload one or more source candidate files (PDF, CSV, JSON, TXT).
  - `config` *(optional)*: A stringified JSON string containing custom projection mappings.
- **Response**: `200 OK` (Or `422 Unprocessable Entity` on schema validation failure)
  ```json
  {
    "success": true,
    "data": {
      "full_name": {
        "value": "Alice Smith",
        "confidence": 0.67,
        "provenance": { "source": "resume.txt", "method": "HEURISTIC_EXTRACT" }
      },
      "primary_email": {
        "value": "alice.smith@example.com",
        "confidence": 0.86,
        "provenance": { "source": "resume.txt", "method": "REGEX_MATCH" }
      }
    },
    "provenance_audit": [
      {
        "field": "name",
        "value": "Alice Smith",
        "source": "resume.txt",
        "method": "HEURISTIC_EXTRACT",
        "confidence": 0.67
      }
    ]
  }
  ```

---

## Merging & Deduplication Details

1. **Deterministic Resolution**:
   If conflicting single-value fields exist (like two different candidate names), the system chooses the name from the highest priority file currently uploaded. If the field is empty in the top-priority file, it inspects the second-priority source, ensuring no data is dropped.
2. **Corporate Suffix Stripping**:
   During experience deduplication, company strings like "Google" and "Google Inc." are equated by removing standard suffixes (`inc`, `corp`, `ltd`, etc.) and stripping formatting, avoiding redundant list items.
3. **Floating Point Rounding**:
   Mathematical scores on boundary limits (e.g. `0.95 * 0.70 = 0.665`) are rounded correctly to `0.67` by appending `Number.EPSILON` to compensate for standard floating-point representation tolerances.
