const test = require('node:test');
const assert = require('node:assert/strict');

const { WorkExperienceController } = require('../dist/src/controllers/workExperience.controller');

const VALID_USER_ID = '11111111-1111-1111-1111-111111111111';

const createResponse = () => {
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
};

const createRequest = (overrides = {}) => ({
  body: {},
  user: {
    id: VALID_USER_ID,
    name: 'Test User',
    email: 'test@example.com',
    role: 'developer',
  },
  correlationId: 'test-correlation-id',
  ...overrides,
});

test('addWorkExperience returns contract envelope with correlation meta on success', async () => {
  const controller = new WorkExperienceController({
    addWorkExperience: async () => ({
      experience_id: 'exp-1',
      company_name: 'Acme',
      role: 'Engineer',
      duration_months: 12,
      verified: false,
      evidence_links: [],
      verification_status: 'pending',
      risk_score: 10,
      added_at: null,
    }),
    getUserWorkExperiences: async () => [],
  });

  const req = createRequest({
    body: {
      company_name: 'Acme',
      role: 'Engineer',
      duration_months: 12,
      evidence_links: 'https://example.com/proof-1,https://example.com/proof-2',
    },
  });
  const res = createResponse();

  await controller.addWorkExperience(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, 'Work experience added successfully');
  assert.equal(res.body.meta.correlationId, 'test-correlation-id');
  assert.equal(res.body.data.company_name, 'Acme');
  assert.equal(Array.isArray(res.body.data.evidence_links), true);
});

test('addWorkExperience validates required fields at boundary', async () => {
  const controller = new WorkExperienceController({
    addWorkExperience: async () => {
      throw new Error('should not be called');
    },
    getUserWorkExperiences: async () => [],
  });

  const req = createRequest({
    body: {
      company_name: 'Acme',
      duration_months: 12,
    },
  });
  const res = createResponse();

  await controller.addWorkExperience(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error, 'VALIDATION_FAILED');
  assert.equal(res.body.meta.correlationId, 'test-correlation-id');
  assert.equal(res.body.error_details.code, 'VALIDATION_FAILED');
});

test('work experience endpoints reject malformed auth identity server-side', async () => {
  const controller = new WorkExperienceController({
    addWorkExperience: async () => {
      throw new Error('should not be called');
    },
    getUserWorkExperiences: async () => {
      throw new Error('should not be called');
    },
  });

  const req = createRequest({
    user: {
      id: 'not-a-uuid',
      name: 'Bad Token',
      email: 'bad@example.com',
      role: 'developer',
    },
  });
  const res = createResponse();

  await controller.getWorkExperiences(req, res);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error, 'UNAUTHORIZED');
  assert.equal(res.body.meta.correlationId, 'test-correlation-id');
});

test('getWorkExperiences returns list envelope and preserves array fallback', async () => {
  const controller = new WorkExperienceController({
    addWorkExperience: async () => {
      throw new Error('not used');
    },
    getUserWorkExperiences: async () => [
      {
        experience_id: 'exp-1',
        company_name: 'Acme',
        role: 'Engineer',
        duration_months: 12,
      },
    ],
  });

  const req = createRequest();
  const res = createResponse();

  await controller.getWorkExperiences(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(Array.isArray(res.body.data), true);
  assert.equal(res.body.data.length, 1);
  assert.equal(res.body.meta.correlationId, 'test-correlation-id');
});
