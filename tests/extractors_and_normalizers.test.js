const AtsJsonExtractor = require('../src/extractors/AtsJsonExtractor');
const RecruiterCsvExtractor = require('../src/extractors/RecruiterCsvExtractor');
const ResumePdfExtractor = require('../src/extractors/ResumePdfExtractor');
const RecruiterNotesExtractor = require('../src/extractors/RecruiterNotesExtractor');
const ExtractorFactory = require('../src/extractors/ExtractorFactory');
const {
  normalizePhone,
  normalizeDate,
  normalizeCountry,
  normalizeSkill,
  normalizeCandidate
} = require('../src/normalizers/Normalizer');

describe('Extractor Module Tests', () => {
  
  describe('ExtractorFactory', () => {
    test('should resolve correct extractor class', () => {
      expect(ExtractorFactory.getExtractor('ATS_JSON')).toBeInstanceOf(AtsJsonExtractor);
      expect(ExtractorFactory.getExtractor('RECRUITER_CSV')).toBeInstanceOf(RecruiterCsvExtractor);
      expect(ExtractorFactory.getExtractor('RESUME_PDF')).toBeInstanceOf(ResumePdfExtractor);
      expect(ExtractorFactory.getExtractor('RECRUITER_NOTES')).toBeInstanceOf(RecruiterNotesExtractor);
    });

    test('should throw for unsupported type', () => {
      expect(() => ExtractorFactory.getExtractor('XML')).toThrow('Unsupported source type');
    });
  });

  describe('AtsJsonExtractor', () => {
    const extractor = new AtsJsonExtractor();

    test('should extract direct fields from structured JSON', () => {
      const data = {
        name: 'Alice Johnson',
        email: 'alice@example.com',
        phone: '123-456-7890',
        location: 'New York, USA',
        skills: ['Node.js', 'React'],
        experience: [
          { role: 'Engineer', company: 'Tech Inc', start_date: '2020-01', end_date: '2022-01' }
        ]
      };
      const result = extractor.extract(data);
      expect(result.name).toBe('Alice Johnson');
      expect(result.emails).toEqual(['alice@example.com']);
      expect(result.phones).toEqual(['123-456-7890']);
      expect(result.skills).toEqual(['Node.js', 'React']);
      expect(result.experience).toHaveLength(1);
      expect(result.experience[0].title).toBe('Engineer');
    });
  });

  describe('RecruiterCsvExtractor', () => {
    const extractor = new RecruiterCsvExtractor();

    test('should extract fields from flat CSV rows', () => {
      const data = [
        {
          full_name: 'Bob Smith',
          email: 'bob@example.com',
          phone_number: '555-555-5555',
          key_skills: 'Java, Spring, SQL',
          current_company: 'Software Corp',
          current_title: 'Backend Dev'
        }
      ];
      const result = extractor.extract(data);
      expect(result.name).toBe('Bob Smith');
      expect(result.emails).toEqual(['bob@example.com']);
      expect(result.phones).toEqual(['555-555-5555']);
      expect(result.skills).toEqual(['Java', 'Spring', 'SQL']);
      expect(result.experience).toHaveLength(1);
      expect(result.experience[0].company).toBe('Software Corp');
    });
  });

  describe('ResumePdfExtractor', () => {
    const extractor = new ResumePdfExtractor();

    test('should heuristically extract from resume text block', () => {
      const text = `
        Jane Doe
        jane.doe@example.com | (206) 555-0199
        github.com/janedoe
        Location: Seattle, WA, USA

        Skills: HTML, AWS, JavaScript

        Experience
        Software Engineer at Microsoft
        June 2018 to Present
        Developing cloud native applications.

        Education
        Bachelor of Science in CS
        University of Washington, 2014-2018
      `;
      const result = extractor.extract(text);
      expect(result.name).toBe('Jane Doe');
      expect(result.emails).toEqual(['jane.doe@example.com']);
      expect(result.phones).toEqual(['(206) 555-0199']);
      expect(result.links).toContain('http://github.com/janedoe'); // Note: extractLinks handles https/http or similar
      expect(result.skills).toContain('HTML'); // Standard vocab items
      expect(result.experience).toHaveLength(1);
      expect(result.experience[0].company).toBe('Microsoft');
      expect(result.education).toHaveLength(1);
      expect(result.education[0].school).toBe('University of Washington');
    });
  });

  describe('RecruiterNotesExtractor', () => {
    const extractor = new RecruiterNotesExtractor();

    test('should extract from informal text recruiter notes', () => {
      const notes = `
        Candidate: Charlie Brown
        charlie.brown@example.com
        Contact: +1 415 555 2671
        Discussed profile. Worked at Google as a Senior Engineer for 3 years.
        Graduated from Stanford with a BS in CS.
      `;
      const result = extractor.extract(notes);
      expect(result.name).toBe('Charlie Brown');
      expect(result.emails).toEqual(['charlie.brown@example.com']);
      expect(result.phones).toEqual(['+1 415 555 2671']);
      expect(result.experience).toHaveLength(1);
      expect(result.experience[0].company).toBe('Google');
      expect(result.experience[0].title).toBe('Senior Engineer');
      expect(result.education).toHaveLength(1);
      expect(result.education[0].school).toBe('Stanford');
    });
  });
});

describe('Normalizer Module Tests', () => {
  
  describe('Phone Normalization', () => {
    test('should format valid phone to E.164 standard', () => {
      expect(normalizePhone('206-555-0199', 'US')).toBe('+12065550199');
      expect(normalizePhone('+919876543210', 'IN')).toBe('+919876543210');
    });

    test('should clean invalid number format to best effort', () => {
      expect(normalizePhone('abc-1234')).toBe('+1234');
    });
  });

  describe('Date Normalization', () => {
    test('should format MM/YYYY to YYYY-MM', () => {
      expect(normalizeDate('06/2021')).toBe('2021-06');
      expect(normalizeDate('6-2021')).toBe('2021-06');
    });

    test('should format Month Year to YYYY-MM', () => {
      expect(normalizeDate('June 2021')).toBe('2021-06');
      expect(normalizeDate('Jan 2018')).toBe('2018-01');
    });

    test('should map current/present to "Present"', () => {
      expect(normalizeDate('Present')).toBe('Present');
      expect(normalizeDate('current')).toBe('Present');
    });

    test('should map single year to YYYY-01', () => {
      expect(normalizeDate('2020')).toBe('2020-01');
    });
  });

  describe('Country Normalization', () => {
    test('should map country to ISO code', () => {
      expect(normalizeCountry('San Francisco, CA, USA')).toBe('US');
      expect(normalizeCountry('London, UK')).toBe('GB');
      expect(normalizeCountry('Berlin, Germany')).toBe('DE');
    });

    test('should return empty if unrecognized', () => {
      expect(normalizeCountry('Unknown City, Unknown Region')).toBe('');
    });
  });

  describe('Skill Normalization', () => {
    test('should canonicalize known skill variants', () => {
      expect(normalizeSkill('js')).toBe('JavaScript');
      expect(normalizeSkill('nodejs')).toBe('Node.js');
      expect(normalizeSkill('postgres')).toBe('PostgreSQL');
    });

    test('should capitalize unknown skill keywords', () => {
      expect(normalizeSkill('distributed systems')).toBe('Distributed Systems');
    });
  });

  describe('Unified normalizeCandidate', () => {
    test('should transform candidate raw entity to fully normalized object', () => {
      const rawCandidate = {
        name: 'john doe ',
        emails: [' JOHN@example.com'],
        phones: [' (206) 555-0199 '],
        skills: ['js', ' Docker ', 'python'],
        experience: [
          { title: 'developer', company: 'tech corp', startDate: 'June 2020', endDate: 'Present' }
        ],
        education: [
          { degree: 'bs cs', school: 'mit', startDate: '2016', endDate: '2020' }
        ],
        location: 'Boston, MA, United States'
      };

      const result = normalizeCandidate(rawCandidate);
      expect(result.name).toBe('john doe');
      expect(result.emails).toEqual(['john@example.com']);
      expect(result.phones).toEqual(['+12065550199']);
      expect(result.skills).toEqual(['JavaScript', 'Docker', 'Python']);
      expect(result.experience[0]).toEqual({
        title: 'developer',
        company: 'tech corp',
        startDate: '2020-06',
        endDate: 'Present',
        description: ''
      });
      expect(result.education[0]).toEqual({
        degree: 'bs cs',
        school: 'mit',
        startDate: '2016-01',
        endDate: '2020-01'
      });
      expect(result.country).toBe('US');
    });
  });
});
