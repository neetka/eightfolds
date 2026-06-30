const Merger = require('../src/merger/Merger');
const ConfidenceEngine = require('../src/confidence/ConfidenceEngine');

describe('ConfidenceEngine Tests', () => {
  test('should calculate field confidence correctly based on source and method', () => {
    // ATS_JSON (DIRECT_MAPPING) -> Weight 0.98 * 1.0 = 0.98
    expect(ConfidenceEngine.calculateFieldConfidence('ATS_JSON', 'name')).toBe(0.98);
    // RESUME_PDF (REGEX_MATCH for emails) -> Weight 0.95 * 0.90 = 0.86
    expect(ConfidenceEngine.calculateFieldConfidence('RESUME_PDF', 'emails')).toBe(0.86);
    // RESUME_PDF (HEURISTIC_EXTRACT for skills) -> Weight 0.95 * 0.70 = 0.67
    expect(ConfidenceEngine.calculateFieldConfidence('RESUME_PDF', 'skills')).toBe(0.67);
    // RECRUITER_NOTES (HEURISTIC_EXTRACT for experience) -> Weight 0.65 * 0.70 = 0.46
    expect(ConfidenceEngine.calculateFieldConfidence('RECRUITER_NOTES', 'experience')).toBe(0.46);
  });

  test('should calculate overall candidate confidence average', () => {
    const list = [
      { confidence: 0.98 },
      { confidence: 0.86 },
      { confidence: 0.67 }
    ];
    // Average: (0.98 + 0.86 + 0.67) / 3 = 0.8366... -> 0.84
    expect(ConfidenceEngine.calculateOverallConfidence(list)).toBe(0.84);
  });
});

describe('Merger and Conflict Resolution Tests', () => {
  
  const mockResume = {
    sourceType: 'RESUME_PDF',
    sourceName: 'my_resume.pdf',
    data: {
      name: 'John Doe',
      emails: ['john.doe@example.com'],
      phones: ['+12065550199'],
      skills: ['JavaScript', 'React'],
      experience: [
        { title: 'Software Engineer', company: 'Google', startDate: '2020-01', endDate: 'Present', description: 'Working on search.' }
      ],
      education: [
        { degree: 'BS CS', school: 'MIT', startDate: '2016-09', endDate: '2020-06' }
      ],
      location: '', // Missing
      country: ''
    }
  };

  const mockAtsJson = {
    sourceType: 'ATS_JSON',
    sourceName: 'ats_profile.json',
    data: {
      name: 'John A. Doe', // Conflict with Resume
      emails: ['john.doe@example.com', 'john.doe.work@example.com'], // Extra email
      phones: ['+12065550199'],
      skills: ['JavaScript', 'Node.js'], // Extra skill, Node.js
      experience: [
        { title: 'Software Engineer', company: 'Google Inc.', startDate: '2020-01', endDate: 'Present', description: 'Search' } // Duplicate of resume
      ],
      education: [],
      location: 'Seattle, WA', // Value present here
      country: 'US'
    }
  };

  const mockNotes = {
    sourceType: 'RECRUITER_NOTES',
    sourceName: 'recruiter_notes.txt',
    data: {
      name: 'Johnny Doe',
      emails: [],
      phones: [],
      skills: ['AWS'],
      experience: [],
      education: [],
      location: 'Seattle, Washington',
      country: 'US'
    }
  };

  test('should merge multiple sources prioritizing Resume > ATS > Notes', () => {
    const merged = Merger.merge([mockNotes, mockAtsJson, mockResume]);

    // Name should resolve to Resume's name ('John Doe') since it has higher priority
    expect(merged.name.value).toBe('John Doe');
    expect(merged.name.provenance.source).toBe('my_resume.pdf');
    expect(merged.name.confidence).toBe(0.67); // RESUME_PDF (HEURISTIC) = 0.95 * 0.70 = 0.67

    // Location is missing in Resume, so should fall back to ATS JSON ('Seattle, WA')
    expect(merged.location.value).toBe('Seattle, WA');
    expect(merged.location.provenance.source).toBe('ats_profile.json');
    expect(merged.location.confidence).toBe(0.98); // ATS_JSON (DIRECT) = 0.98 * 1.0 = 0.98

    // Emails should combine unique values
    expect(merged.emails).toHaveLength(2);
    // john.doe@example.com is in both Resume & ATS, should retain Resume provenance (higher priority)
    const primaryEmail = merged.emails.find(e => e.value === 'john.doe@example.com');
    expect(primaryEmail.provenance.source).toBe('my_resume.pdf');
    expect(primaryEmail.confidence).toBe(0.86);

    // john.doe.work@example.com only in ATS, should keep ATS provenance
    const workEmail = merged.emails.find(e => e.value === 'john.doe.work@example.com');
    expect(workEmail.provenance.source).toBe('ats_profile.json');
    expect(workEmail.confidence).toBe(0.98);

    // Skills should union deduplicated lists
    const skillNames = merged.skills.map(s => s.value);
    expect(skillNames).toContain('JavaScript');
    expect(skillNames).toContain('React');
    expect(skillNames).toContain('Node.js');
    expect(skillNames).toContain('AWS');
    expect(merged.skills).toHaveLength(4);

    // Experience should deduplicate matching companies ("Google" vs "Google Inc.")
    expect(merged.experience).toHaveLength(1);
    expect(merged.experience[0].value.company).toBe('Google'); // Keeps higher priority Resume version
    expect(merged.experience[0].provenance.source).toBe('my_resume.pdf');

    // Education should resolve MIT from resume
    expect(merged.education).toHaveLength(1);
    expect(merged.education[0].value.school).toBe('MIT');

    // Verify overall confidence is calculated
    expect(merged._overallConfidence).toBeGreaterThan(0.5);
    expect(merged._overallConfidence).toBeLessThan(1.0);
  });
});
