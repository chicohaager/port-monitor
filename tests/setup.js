// Test setup file for Jest
const path = require('path');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
process.env.PORT = '3001'; // Use different port for tests
process.env.DATABASE_PATH = ':memory:'; // Use in-memory database for tests

// Global test timeout
jest.setTimeout(10000);

// Mock console methods to reduce noise in tests
const originalConsole = { ...console };

beforeAll(() => {
  // Suppress console output during tests unless verbose
  if (!process.env.VERBOSE_TESTS) {
    console.log = jest.fn();
    console.info = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  }
});

afterAll(() => {
  // Restore console methods
  Object.assign(console, originalConsole);
});

// Global test helpers
global.testHelpers = {
  // Helper to wait for async operations
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Helper to create test user session
  createTestSession: () => ({
    username: 'testuser',
    role: 'admin',
    createdAt: new Date(),
    lastAccess: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
  }),

  // Helper to create test port data
  createTestPort: (overrides = {}) => ({
    port: 3000,
    protocol: 'tcp',
    address: '127.0.0.1',
    state: 'LISTEN',
    process: 'node',
    pid: 1234,
    type: 'user',
    ...overrides
  }),

  // Helper to create test security alert
  createTestAlert: (overrides = {}) => ({
    type: 'unknown_process',
    severity: 'medium',
    message: 'Test security alert',
    port: 3000,
    process: 'test-process',
    timestamp: new Date().toISOString(),
    ...overrides
  })
};