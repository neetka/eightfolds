const ProvenanceTracker = require('../src/provenance/ProvenanceTracker');
const ProjectionLayer = require('../src/projection/ProjectionLayer');
const Validator = require('../src/validator/Validator');

describe('ProvenanceTracker Tests', () => {
  test('should generate flat audit log of provenance details', () => {
    const mergedProfile = {
      name: { value: 'Jane Doe', confidence: 0.9, provenance: { source: 'ats.json', method: 'DIRECT_MAPPING' } },
      emails: [
        { value: 'jane@example.com', confidence: 0.8, provenance: { source: 'resume.pdf', method: 'REGEX_MATCH' } }
      ]
    };
    
    const log = ProvenanceTracker.getAuditLog(mergedProfile);
    expect(log).toHaveLength(2);
    expect(log[0]).toEqual({ field: 'name', value: 'Jane Doe', source: 'ats.json', method: 'DIRECT_MAPPING', confidence: 0.9 });
  });
});

describe('ProjectionLayer Tests', () => {
  const mergedProfile = {
    name: { value: 'Jane Doe', confidence: 0.67, provenance: { source: 'resume.pdf', method: 'HEURISTIC' } },
    emails: [
      { value: 'jane@example.com', confidence: 0.9, provenance: { source: 'ats.json', method: 'DIRECT_MAPPING' } }
    ],
    skills: [
      { value: 'JavaScript', confidence: 0.8, provenance: { source: 'resume.pdf', method: 'HEURISTIC' } }
    ],
    location: { value: 'San Francisco, CA, USA', confidence: 0.9, provenance: { source: 'ats.json', method: 'DIRECT' } }
  };

  test('should project paths into strict canonical format', () => {
    const config = {
      fields: [
        { path: 'full_name', from: 'name' },
        { path: 'emails' },
        { path: 'skills' },
        { path: 'location' }
      ]
    };

    const projected = ProjectionLayer.project(mergedProfile, config);
    
    // Primitives
    expect(projected.full_name).toBe('Jane Doe');
    expect(projected.emails).toEqual(['jane@example.com']);
    
    // Custom objects
    expect(projected.skills).toEqual(['JavaScript']);
    
    expect(projected.location.city).toBe('San Francisco');
    expect(projected.location.region).toBe('CA');
    expect(projected.location.country).toBe('US');
  });

  test('should handle on_missing behaviors: null', () => {
    const config = { fields: [{ path: 'headline' }], on_missing: 'null' };
    const projected = ProjectionLayer.project(mergedProfile, config);
    expect(projected.headline).toBeNull();
  });
});

describe('Validator Tests', () => {
  const config = {
    fields: [
      { path: 'full_name', required: true },
      { path: 'emails' },
      { path: 'location' }
    ]
  };

  test('should validate successful projected payload', () => {
    const validPayload = {
      full_name: 'John Smith',
      emails: ['john@example.com'],
      location: { city: 'SF', region: 'CA', country: 'US' }
    };

    const res = Validator.validate(validPayload, config);
    expect(res.success).toBe(true);
  });

  test('should report errors for missing required fields', () => {
    const invalidPayload = {
      full_name: null,
      emails: []
    };

    const res = Validator.validate(invalidPayload, config);
    expect(res.success).toBe(false);
    expect(res.errors[0]).toContain('Required field "full_name" is empty or missing');
  });
});
