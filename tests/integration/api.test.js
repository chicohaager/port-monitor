const request = require('supertest');
const express = require('express');
const path = require('path');

// Mock dependencies before requiring the app
jest.mock('../../server/services/portMonitor-optimized');
jest.mock('../../server/services/securityAnalyzer');
jest.mock('../../server/services/database');
jest.mock('../../server/services/dockerIntegration');

const { authMiddleware } = require('../../server/middleware/auth');

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
    app.use(require('../../server/middleware/security'));

    // Auth routes
    app.post('/api/auth/login', (req, res) => authMiddleware.handleLogin(req, res));
    app.post('/api/auth/logout', (req, res) => authMiddleware.handleLogout(req, res));
    app.get('/api/auth/check', (req, res) => authMiddleware.handleSessionCheck(req, res));

    // Mock API routes for testing
    app.get('/api/ports', (req, res) => {
      res.json({
        success: true,
        data: {
          ports: [
            { port: 22, protocol: 'tcp', process: 'sshd', state: 'LISTEN' },
            { port: 80, protocol: 'tcp', process: 'nginx', state: 'LISTEN' }
          ],
          stats: {
            totalPorts: 2,
            totalConnections: 5,
            dockerPorts: 0
          }
        }
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

    // Start server
    server = app.listen(0); // Use random available port
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  beforeEach(() => {
    // Clear sessions before each test
    authMiddleware.sessions?.clear();
  });

  describe('Authentication Endpoints', () => {
    describe('POST /api/auth/login', () => {
      test('should login with valid credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'admin',
            password: 'zimaos2024'
          })
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          message: 'Login successful',
          user: {
            username: 'admin',
            role: 'admin'
          }
        });

        // Should set session cookie
        expect(response.headers['set-cookie']).toBeDefined();
        const sessionCookie = response.headers['set-cookie'].find(cookie =>
          cookie.startsWith('session_token=')
        );
        expect(sessionCookie).toBeDefined();
        expect(sessionCookie).toContain('HttpOnly');
        expect(sessionCookie).toContain('SameSite=Strict');
      });

      test('should reject invalid credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'admin',
            password: 'wrongpassword'
          })
          .expect(401);

        expect(response.body).toMatchObject({
          success: false,
          error: 'Invalid credentials'
        });
      });

      test('should reject missing credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'admin'
            // Missing password
          })
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: 'Username and password are required'
        });
      });

      test('should reject empty credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            username: '',
            password: ''
          })
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: 'Username and password are required'
        });
      });

      test('should handle malformed JSON', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .type('json')
          .send('invalid json')
          .expect(400);
      });
    });

    describe('POST /api/auth/logout', () => {
      test('should logout successfully with valid session', async () => {
        // First, login to get a session
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'admin',
            password: 'zimaos2024'
          });

        const sessionCookie = loginResponse.headers['set-cookie']
          .find(cookie => cookie.startsWith('session_token='))
          .split(';')[0];

        // Then logout
        const response = await request(app)
          .post('/api/auth/logout')
          .set('Cookie', sessionCookie)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          message: 'Successfully logged out'
        });

        // Should clear session cookie
        expect(response.headers['set-cookie']).toBeDefined();
        const clearCookie = response.headers['set-cookie'].find(cookie =>
          cookie.startsWith('session_token=')
        );
        expect(clearCookie).toContain('Expires=Thu, 01 Jan 1970');
      });

      test('should logout successfully without session', async () => {
        const response = await request(app)
          .post('/api/auth/logout')
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          message: 'Successfully logged out'
        });
      });
    });

    describe('GET /api/auth/check', () => {
      test('should return user info for valid session', async () => {
        // Login first
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'admin',
            password: 'zimaos2024'
          });

        const sessionCookie = loginResponse.headers['set-cookie']
          .find(cookie => cookie.startsWith('session_token='))
          .split(';')[0];

        // Check session
        const response = await request(app)
          .get('/api/auth/check')
          .set('Cookie', sessionCookie)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          authenticated: true,
          user: {
            username: 'admin',
            role: 'admin'
          }
        });
      });

      test('should return unauthenticated for invalid session', async () => {
        const response = await request(app)
          .get('/api/auth/check')
          .set('Cookie', 'session_token=invalid-token')
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          authenticated: false
        });
      });

      test('should return unauthenticated without session', async () => {
        const response = await request(app)
          .get('/api/auth/check')
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          authenticated: false
        });
      });
    });
  });

  describe('API Endpoints', () => {
    let sessionCookie;

    beforeEach(async () => {
      // Login and get session cookie for protected endpoints
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'zimaos2024'
        });

      sessionCookie = loginResponse.headers['set-cookie']
        .find(cookie => cookie.startsWith('session_token='))
        .split(';')[0];
    });

    describe('GET /api/ports', () => {
      test('should return port data for authenticated user', async () => {
        const response = await request(app)
          .get('/api/ports')
          .set('Cookie', sessionCookie)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            ports: expect.any(Array),
            stats: expect.objectContaining({
              totalPorts: expect.any(Number),
              totalConnections: expect.any(Number),
              dockerPorts: expect.any(Number)
            })
          }
        });

        expect(response.body.data.ports.length).toBeGreaterThan(0);
        expect(response.body.data.ports[0]).toMatchObject({
          port: expect.any(Number),
          protocol: expect.any(String),
          process: expect.any(String),
          state: expect.any(String)
        });
      });

      test('should reject unauthenticated requests', async () => {
        const response = await request(app)
          .get('/api/ports')
          .expect(401);

        expect(response.body).toMatchObject({
          success: false,
          error: 'Authentication required'
        });
      });
    });

    describe('GET /api/security/alerts', () => {
      test('should return security alerts for authenticated user', async () => {
        const response = await request(app)
          .get('/api/security/alerts')
          .set('Cookie', sessionCookie)
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

      test('should reject unauthenticated requests', async () => {
        const response = await request(app)
          .get('/api/security/alerts')
          .expect(401);

        expect(response.body).toMatchObject({
          success: false,
          error: 'Authentication required'
        });
      });
    });
  });

  describe('Security Headers', () => {
    test('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/api/auth/check')
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

  describe('Rate Limiting', () => {
    test('should handle high request volume gracefully', async () => {
      const requests = Array(10).fill().map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            username: 'admin',
            password: 'wrongpassword'
          })
      );

      const responses = await Promise.all(requests);

      // All should be processed (might be rate limited but should respond)
      responses.forEach(response => {
        expect([401, 429]).toContain(response.status);
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
        .post('/api/auth/login')
        .type('json')
        .send('{ invalid json }')
        .expect(400);
    });

    test('should handle large request bodies', async () => {
      const largeData = 'x'.repeat(1024 * 1024); // 1MB of data

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: largeData
        });

      // Should either reject or handle gracefully
      expect([400, 413, 401]).toContain(response.status);
    });
  });
});