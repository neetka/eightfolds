const ProvenanceTracker = require('../src/provenance/ProvenanceTracker');
const ProjectionLayer = require('../src/projection/ProjectionLayer');
const Validator = require('../src/validator/Validator');

describe('ProvenanceTracker Tests', () => {
  const mergedProfile = {
    name: { value: 'Jane Doe', provenance: { source: 'resume.pdf', method: 'HEURISTIC' }, confidence: 0.67 },
    emails: [
      { value: 'jane@example.com', provenance: { source: 'resume.pdf', method: 'REGEX' }, confidence: 0.86 }
    ]
  };

  test('should generate flat audit log of provenance details', () => {
    const log = ProvenanceTracker.getAuditLog(mergedProfile);
    expect(log).toHaveLength(2);
    expect(log[0]).toEqual({
      field: 'name',
      value: 'Jane Doe',
      source: 'resume.pdf',
      method: 'HEURISTIC',
      confidence: 0.67
    });
    expect(log[1]).toEqual({
      field: 'emails',
      value: 'jane@example.com',
      source: 'resume.pdf',
      method: 'REGEX',
      confidence: 0.86
    });
  });
});

describe('ProjectionLayer Tests', () => {
  const mergedProfile = {
    name: { value: 'Jane Doe', provenance: { source: 'resume.pdf', method: 'HEURISTIC' }, confidence: 0.67 },
    emails: [
      { value: 'jane@example.com', provenance: { source: 'resume.pdf', method: 'REGEX' }, confidence: 0.86 }
    ],
    experience: [
      {
        value: { title: 'Engineer', company: 'Google' },
        provenance: { source: 'resume.pdf', method: 'HEURISTIC' },
        confidence: 0.85
      }
    ],
    location: { value: null, provenance: null, confidence: 0 }
  };

  test('should project paths with metadata when enabled', () => {
    const config = {
      fields: [
        { path: 'full_name' }, // Fallback to 'name'
        { path: 'primary_email', from: 'emails[0]' },
        { path: 'company', from: 'experience[0].company' }
      ],
      include_confidence: true,
      include_provenance: true
    };

    const projected = ProjectionLayer.project(mergedProfile, config);

    expect(projected.full_name).toEqual({
      value: 'Jane Doe',
      confidence: 0.67,
      provenance: { source: 'resume.pdf', method: 'HEURISTIC' }
    });

    expect(projected.primary_email).toEqual({
      value: 'jane@example.com',
      confidence: 0.86,
      provenance: { source: 'resume.pdf', method: 'REGEX' }
    });

    // Nested inheritance test: projected.company inherits provenance from experience[0]
    expect(projected.company).toEqual({
      value: 'Google',
      confidence: 0.85,
      provenance: { source: 'resume.pdf', method: 'HEURISTIC' }
    });
  });

  test('should strip metadata wrappers when include_confidence/provenance are false', () => {
    const config = {
      fields: [
        { path: 'full_name' },
        { path: 'primary_email', from: 'emails[0]' }
      ],
      include_confidence: false,
      include_provenance: false
    };

    const projected = ProjectionLayer.project(mergedProfile, config);

    expect(projected.full_name).toBe('Jane Doe');
    expect(projected.primary_email).toBe('jane@example.com');
  });

  test('should handle on_missing behaviors: null and omit', () => {
    // 1. null
    const configNull = {
      fields: [{ path: 'location' }],
      on_missing: 'null',
      include_confidence: false,
      include_provenance: false
    };
    const projectedNull = ProjectionLayer.project(mergedProfile, configNull);
    expect(projectedNull.location).toBeNull();

    // 2. omit
    const configOmit = {
      fields: [{ path: 'location' }],
      on_missing: 'omit',
      include_confidence: false,
      include_provenance: false
    };
    const projectedOmit = ProjectionLayer.project(mergedProfile, configOmit);
    expect(projectedOmit.location).toBeUndefined();
  });
});

describe('Validator Tests', () => {
  const config = {
    fields: [
      { path: 'full_name', required: true },
      { path: 'primary_email', from: 'emails[0]' }
    ],
    include_confidence: true,
    include_provenance: true
  };

  test('should validate successful projected payload', () => {
    const validPayload = {
      full_name: { value: 'Jane Doe', confidence: 0.67, provenance: { source: 'resume.pdf', method: 'HEURISTIC' } },
      primary_email: { value: 'jane@example.com', confidence: 0.86, provenance: { source: 'resume.pdf', method: 'REGEX' } }
    };

    const res = Validator.validate(validPayload, config);
    expect(res.success).toBe(true);
  });

  test('should report errors for missing required fields', () => {
    const invalidPayload = {
      full_name: { value: null, confidence: 0, provenance: null }, // Required but null
      primary_email: { value: 'jane@example.com', confidence: 0.86, provenance: { source: 'resume.pdf', method: 'REGEX' } }
    };

    const res = Validator.validate(invalidPayload, config);
    expect(res.success).toBe(false);
    expect(res.errors[0]).toContain('Required field "full_name" is empty or missing');
  });
});
