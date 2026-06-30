# Multi-Source Candidate Data Transformer

A production-grade, modular Node.js ETL pipeline that ingests candidate data from multiple structured (CSV, JSON) and unstructured (PDF Resumes, TXT Recruiter Notes) sources, merges duplicate information using a deterministic priority hierarchy, assigns field-level confidence scores, tracks data provenance, and outputs a strictly flattened JSON profile validated with Zod.

## Premium Web Interface
This project now includes a stunning, premium dark-mode web UI! Instead of interacting purely through CLI or Postman, you can navigate to `http://localhost:3000` to utilize a sleek drag-and-drop zone to intuitively combine your candidate files.

Features include:
- Glassmorphism design and micro-animations.
- Automatic `FormData` building for REST API consumption.
- Client-side JSON syntax highlighting for immediate visual verification.

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
- **Projection (`src/projection/`)**: Formats output into a **strictly flattened JSON schema**, extracting primitives directly from the data without deep nested metadata wrappers.
- **Validator (`src/validator/`)**: Dynamically compiles a Zod schema matching the flat primitive configuration. Ensures required fields are present and handles validation errors gracefully.

---

## Technology Stack

- **Runtime**: Node.js (JavaScript, CommonJS modules)
- **Framework**: Express.js
- **Ingestion & Parsing**: `pdf-parse`, `csv-parser`, `multer`
- **Validation**: `zod`, `libphonenumber-js`
- **Frontend**: Vanilla HTML5/CSS3/JS, Custom Dark Theme
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
4. Start the Application:
   ```bash
   npm start
   ```
5. Navigate to **http://localhost:3000** to use the Drag-and-Drop Interface!

---

## REST API Documentation

The server runs on port `3000`.

### 1. Transform Candidates
- **Endpoint**: `POST /api/candidates/transform`
- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `files`: Upload one or more source candidate files (PDF, CSV, JSON, TXT).
- **Response**: `200 OK` (Or `422 Unprocessable Entity` on schema validation failure)
  ```json
  {
    "success": true,
    "data": {
      "full_name": "Nikk Attry",
      "emails": [
        "nikk@gmail.com",
        "nikk.attry@gmail.com"
      ],
      "phones": [
        "+919876543210"
      ],
      "skills": [
        "JavaScript",
        "React",
        "Node.js",
        "MongoDB",
        "Python",
        "C++"
      ],
      "headline": "Software Engineer Intern",
      "github": "https://github.com/nikkattry",
      "overall_confidence": 0.93
    },
    "provenance_audit": [
      {
        "field": "name",
        "source": "resume.pdf",
        "method": "HEURISTIC_EXTRACT",
        "confidence": 0.95
      }
    ]
  }
  ```

---

## Merging & Deduplication Details

1. **Deterministic Resolution**:
   If conflicting single-value fields exist, the system chooses the data from the highest priority file currently uploaded. 
2. **Corporate Suffix Stripping**:
   During experience deduplication, company strings like "Google" and "Google Inc." are equated by removing standard suffixes (`inc`, `corp`, `ltd`, etc.) and stripping formatting, avoiding redundant list items.
3. **Floating Point Rounding**:
   Mathematical scores on boundary limits (e.g. `0.95 * 0.70 = 0.665`) are rounded correctly to `0.67` by appending `Number.EPSILON` to compensate for standard floating-point representation tolerances.
