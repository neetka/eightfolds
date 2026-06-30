const path = require('path');
const fs = require('fs').promises;
const ParserFactory = require('../src/parsers/ParserFactory');
const CsvParser = require('../src/parsers/CsvParser');
const JsonParser = require('../src/parsers/JsonParser');
const PdfParser = require('../src/parsers/PdfParser');
const TxtParser = require('../src/parsers/TxtParser');

// Mock pdf-parse module
jest.mock('pdf-parse', () => {
  return jest.fn().mockImplementation((buffer) => {
    if (buffer.toString() === 'FAIL_PDF') {
      return Promise.reject(new Error('Corrupted PDF'));
    }
    return Promise.resolve({ text: 'Extracted Resume Content' });
  });
});

describe('Parser Module Tests', () => {
  
  describe('ParserFactory', () => {
    test('should resolve correct parser class based on file extension', () => {
      expect(ParserFactory.getParser('resume.pdf')).toBeInstanceOf(PdfParser);
      expect(ParserFactory.getParser('data.csv')).toBeInstanceOf(CsvParser);
      expect(ParserFactory.getParser('ats.json')).toBeInstanceOf(JsonParser);
      expect(ParserFactory.getParser('notes.txt')).toBeInstanceOf(TxtParser);
    });

    test('should throw error for unsupported extensions', () => {
      expect(() => ParserFactory.getParser('document.docx')).toThrow('Unsupported file extension: .docx');
    });

    test('should throw error for invalid input', () => {
      expect(() => ParserFactory.getParser(null)).toThrow('Valid filename is required');
    });
  });

  describe('JsonParser', () => {
    const jsonParser = new JsonParser();

    test('should parse valid JSON buffer', async () => {
      const mockData = { name: 'John Doe', email: 'john@example.com' };
      const buffer = Buffer.from(JSON.stringify(mockData));
      const result = await jsonParser.parse(buffer, 'test.json');

      expect(result.sourceType).toBe('ATS_JSON');
      expect(result.sourceName).toBe('test.json');
      expect(result.rawData).toEqual(mockData);
    });

    test('should throw error for malformed JSON', async () => {
      const buffer = Buffer.from('{invalid-json}');
      await expect(jsonParser.parse(buffer, 'test.json')).rejects.toThrow('JSON Parsing failed');
    });
  });

  describe('TxtParser', () => {
    const txtParser = new TxtParser();

    test('should parse text buffer', async () => {
      const text = 'Simple Recruiter Notes text content';
      const buffer = Buffer.from(text);
      const result = await txtParser.parse(buffer, 'notes.txt');

      expect(result.sourceType).toBe('RECRUITER_NOTES');
      expect(result.sourceName).toBe('notes.txt');
      expect(result.rawData).toBe(text);
    });
  });

  describe('PdfParser', () => {
    const pdfParser = new PdfParser();

    test('should parse PDF buffer successfully', async () => {
      const buffer = Buffer.from('VALID_PDF');
      const result = await pdfParser.parse(buffer, 'resume.pdf');

      expect(result.sourceType).toBe('RESUME_PDF');
      expect(result.sourceName).toBe('resume.pdf');
      expect(result.rawData).toBe('Extracted Resume Content');
    });

    test('should reject on corrupted PDF buffer', async () => {
      const buffer = Buffer.from('FAIL_PDF');
      await expect(pdfParser.parse(buffer, 'resume.pdf')).rejects.toThrow('PDF Parsing failed');
    });
  });

  describe('CsvParser', () => {
    const csvParser = new CsvParser();

    test('should parse valid CSV buffer', async () => {
      const csvData = 'name,email,skills\nJane Doe,jane@example.com,"JS, Node"\nBob Smith,bob@example.com,Python';
      const buffer = Buffer.from(csvData);
      const result = await csvParser.parse(buffer, 'candidates.csv');

      expect(result.sourceType).toBe('RECRUITER_CSV');
      expect(result.sourceName).toBe('candidates.csv');
      expect(result.rawData).toHaveLength(2);
      expect(result.rawData[0]).toEqual({
        name: 'Jane Doe',
        email: 'jane@example.com',
        skills: 'JS, Node'
      });
      expect(result.rawData[1]).toEqual({
        name: 'Bob Smith',
        email: 'bob@example.com',
        skills: 'Python'
      });
    });
  });
});
