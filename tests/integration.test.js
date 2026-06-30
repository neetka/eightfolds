const request = require('supertest');
const app = require('../server');

describe('API Integration Tests', () => {
  
  describe('GET /health', () => {
    test('should return 200 and system status', async () => {
      const res = await request(app).get('/health');
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('UP');
    });
  });

  describe('POST /api/candidates/transform', () => {
    
    test('should fail with 400 if no files uploaded', async () => {
      const res = await request(app)
        .post('/api/candidates/transform')
        .send(); // No files

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors[0]).toContain('No candidate files uploaded');
    });

    test('should fail with 400 if invalid config json is passed', async () => {
      const res = await request(app)
        .post('/api/candidates/transform')
        .field('config', '{invalid-config}')
        .attach('files', Buffer.from('Jane Doe\njane@example.com'), 'resume.txt');

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors[0]).toContain('Invalid config field JSON');
    });

    test('should successfully merge, project, and validate uploaded files', async () => {
      const mockResume = `
        Candidate: Alice Smith
        alice.smith@example.com | 206-555-0199
        github.com/alicesmith
        Location: Boston, MA, USA

        Skills: JavaScript, Node.js

        Notes: Discussed candidate. She worked at Amazon as a Software Engineer.
      `;

      const mockAtsJson = JSON.stringify({
        name: 'Alice Smith',
        email: 'alice.smith@example.com',
        phone: '206-555-0199',
        skills: ['React'],
        experience: [],
        education: [
          { degree: 'BS CS', school: 'MIT', start_date: '2016-09', end_date: '2020-06' }
        ],
        location: 'Boston, MA',
        country: 'US'
      });

      const res = await request(app)
        .post('/api/candidates/transform')
        .attach('files', Buffer.from(mockResume), 'resume.txt')
        .attach('files', Buffer.from(mockAtsJson), 'ats.json');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.full_name.value).toBe('Alice Smith');
      expect(res.body.data.primary_email.value).toBe('alice.smith@example.com');
      
      // Skills union test (JavaScript, Node.js, React)
      const skills = res.body.data.skills.map(s => s.value);
      expect(skills).toContain('JavaScript');
      expect(skills).toContain('Node.js');
      expect(skills).toContain('React');
      
      // Education and Experience merged E2E
      expect(res.body.data.experience[0].value.company).toBe('Amazon');
      expect(res.body.data.education[0].value.school).toBe('MIT');

      // Provenance structure check
      expect(res.body.provenance_audit).toBeDefined();
      expect(res.body.provenance_audit.length).toBeGreaterThan(0);
    });

    test('should fail validation and return 422 if required fields are missing', async () => {
      // Missing name, which is required
      const emptyNotes = `
        No candidate name listed here.
        Contact: 206-555-0199
      `;

      // Custom config making name required
      const config = JSON.stringify({
        fields: [
          { path: 'full_name', required: true }
        ],
        include_confidence: false,
        include_provenance: false
      });

      const res = await request(app)
        .post('/api/candidates/transform')
        .field('config', config)
        .attach('files', Buffer.from(emptyNotes), 'notes.txt');

      expect(res.statusCode).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.errors[0]).toContain('Required field "full_name" is empty or missing');
    });
  });
});
