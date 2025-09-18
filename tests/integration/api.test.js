const request = require('supertest');
const express = require('express');
const path = require('path');

// Mock dependencies before requiring the app
jest.mock('../../server/services/portMonitor-optimized');
jest.mock('../../server/services/securityAnalyzer');
jest.mock('../../server/services/database');
jest.mock('../../server/services/dockerIntegration');

describe('API Integration Tests', () => {
  let app;
  let server;

  beforeAll(async () => {
    // Create test app similar to main app but with mocked services
    app = express();

    // Apply middleware
    app.use(express.json());
    app.use(require('cookie-parser')());

    // Apply security middleware
    const { securityHeaders, requestId } = require('../../server/middleware/security');
    app.use(securityHeaders);
    app.use(requestId);

    // Mock API routes for testing
    app.get('/api/ports', (req, res) => {
      res.json({
        success: true,
        data: [
          { port: 22, protocol: 'tcp', process: 'sshd', state: 'LISTEN' },
          { port: 80, protocol: 'tcp', process: 'nginx', state: 'LISTEN' }
        ]
      });
    });

    app.get('/api/security/alerts', (req, res) => {
      res.json({
        success: true,
        data: [
          {
            type: 'unknown_process',
            severity: 'medium',
            message: 'Test alert',
            port: 12345,
            process: 'unknown',
            timestamp: new Date().toISOString()
          }
        ]
      });
    });

    app.get('/api/health', (req, res) => {
      res.json({
        success: true,
        status: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage()
      });
    });

    // Start server
    server = app.listen(0); // Use random available port
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  describe('API Endpoints', () => {
    describe('GET /api/ports', () => {
      test('should return port data', async () => {
        const response = await request(app)
          .get('/api/ports')
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.any(Array)
        });

        expect(response.body.data.length).toBeGreaterThan(0);
        expect(response.body.data[0]).toMatchObject({
          port: expect.any(Number),
          protocol: expect.any(String),
          process: expect.any(String),
          state: expect.any(String)
        });
      });
    });

    describe('GET /api/security/alerts', () => {
      test('should return security alerts', async () => {
        const response = await request(app)
          .get('/api/security/alerts')
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.any(Array)
        });

        if (response.body.data.length > 0) {
          expect(response.body.data[0]).toMatchObject({
            type: expect.any(String),
            severity: expect.any(String),
            message: expect.any(String),
            port: expect.any(Number),
            process: expect.any(String),
            timestamp: expect.any(String)
          });
        }
      });
    });

    describe('GET /api/health', () => {
      test('should return health status', async () => {
        const response = await request(app)
          .get('/api/health')
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          status: 'healthy',
          uptime: expect.any(Number),
          memory: expect.any(Object)
        });
      });
    });
  });

  describe('Security Headers', () => {
    test('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      // Check for security headers
      expect(response.headers).toMatchObject({
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'SAMEORIGIN',
        'x-xss-protection': '0',
        'strict-transport-security': expect.stringContaining('max-age='),
        'content-security-policy': expect.stringContaining('default-src'),
        'referrer-policy': 'no-referrer'
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle 404 routes', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);
    });

    test('should handle invalid JSON in request body', async () => {
      const response = await request(app)
        .post('/api/ports')
        .type('json')
        .send('{ invalid json }')
        .expect(400);
    });
  });
});