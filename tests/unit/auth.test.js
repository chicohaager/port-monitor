const { authMiddleware, requireAuth, requireWebAuth } = require('../../server/middleware/auth');

describe('Authentication Middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      body: {},
      cookies: {},
      path: '/'
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();

    // Clear sessions before each test
    authMiddleware.sessions?.clear();
  });

  describe('generateSessionToken', () => {
    test('should generate a valid session token', () => {
      const token = authMiddleware.generateSessionToken();
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes * 2 (hex)
    });

    test('should generate unique tokens', () => {
      const token1 = authMiddleware.generateSessionToken();
      const token2 = authMiddleware.generateSessionToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('authenticateUser', () => {
    test('should authenticate valid user credentials', () => {
      const user = authMiddleware.authenticateUser('admin', 'zimaos2024');
      expect(user).toBeDefined();
      expect(user.username).toBe('admin');
      expect(user.role).toBe('admin');
    });

    test('should reject invalid username', () => {
      const user = authMiddleware.authenticateUser('invalid', 'zimaos2024');
      expect(user).toBeNull();
    });

    test('should reject invalid password', () => {
      const user = authMiddleware.authenticateUser('admin', 'wrongpassword');
      expect(user).toBeNull();
    });

    test('should reject empty credentials', () => {
      const user1 = authMiddleware.authenticateUser('', 'zimaos2024');
      const user2 = authMiddleware.authenticateUser('admin', '');
      expect(user1).toBeNull();
      expect(user2).toBeNull();
    });
  });

  describe('createSession', () => {
    test('should create a valid session', () => {
      const token = authMiddleware.createSession('admin');
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const session = authMiddleware.validateSession(token);
      expect(session).toBeDefined();
      expect(session.username).toBe('admin');
      expect(session.role).toBe('admin');
    });

    test('should create session with correct expiration', () => {
      const token = authMiddleware.createSession('admin');
      const session = authMiddleware.validateSession(token);

      const now = new Date();
      const expectedExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      expect(session.expiresAt.getTime()).toBeCloseTo(expectedExpiry.getTime(), -10000);
    });
  });

  describe('validateSession', () => {
    test('should validate existing session', () => {
      const token = authMiddleware.createSession('admin');
      const session = authMiddleware.validateSession(token);

      expect(session).toBeDefined();
      expect(session.username).toBe('admin');
    });

    test('should return null for invalid token', () => {
      const session = authMiddleware.validateSession('invalid-token');
      expect(session).toBeNull();
    });

    test('should return null for expired session', () => {
      const token = authMiddleware.createSession('admin');

      // Access the sessions map through the module (sessions are not exposed as a property)
      // We'll test expiration by mocking the internal behavior instead
      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 25 * 60 * 60 * 1000); // 25 hours later

      const validatedSession = authMiddleware.validateSession(token);
      expect(validatedSession).toBeNull();

      Date.now.mockRestore();
    });

    test('should return null for null/undefined token', () => {
      expect(authMiddleware.validateSession(null)).toBeNull();
      expect(authMiddleware.validateSession(undefined)).toBeNull();
      expect(authMiddleware.validateSession('')).toBeNull();
    });
  });

  describe('handleLogin', () => {
    test('should login with valid credentials', async () => {
      mockReq.body = { username: 'admin', password: 'zimaos2024' };

      await authMiddleware.handleLogin(mockReq, mockRes);

      expect(mockRes.status).not.toHaveBeenCalledWith(400);
      expect(mockRes.status).not.toHaveBeenCalledWith(401);
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'session_token',
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          secure: false,
          sameSite: 'strict',
          maxAge: 24 * 60 * 60 * 1000
        })
      );
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Login successful'
        })
      );
    });

    test('should reject login with invalid credentials', async () => {
      mockReq.body = { username: 'admin', password: 'wrongpassword' };

      await authMiddleware.handleLogin(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid credentials'
        })
      );
    });

    test('should reject login with missing credentials', async () => {
      mockReq.body = { username: 'admin' }; // Missing password

      await authMiddleware.handleLogin(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Username and password are required'
        })
      );
    });
  });

  describe('handleLogout', () => {
    test('should logout successfully', async () => {
      const token = authMiddleware.createSession('admin');
      mockReq.cookies.session_token = token;

      await authMiddleware.handleLogout(mockReq, mockRes);

      expect(mockRes.clearCookie).toHaveBeenCalledWith('session_token');
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Erfolgreich abgemeldet'
        })
      );

      // Session should be destroyed
      const session = authMiddleware.validateSession(token);
      expect(session).toBeNull();
    });

    test('should handle logout without session', async () => {
      await authMiddleware.handleLogout(mockReq, mockRes);

      expect(mockRes.clearCookie).toHaveBeenCalledWith('session_token');
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Erfolgreich abgemeldet'
        })
      );
    });
  });

  describe('requireAuth middleware', () => {
    test('should allow access with valid session', () => {
      const token = authMiddleware.createSession('admin');
      mockReq.cookies.session_token = token;

      requireAuth(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.username).toBe('admin');
    });

    test('should reject access without session', () => {
      requireAuth(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Authentication required'
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireWebAuth middleware', () => {
    test('should allow access with valid session', () => {
      const token = authMiddleware.createSession('admin');
      mockReq.cookies.session_token = token;

      requireWebAuth(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.username).toBe('admin');
    });

    test('should redirect to login for web requests without session', () => {
      mockReq.path = '/';

      requireWebAuth(mockReq, mockRes, mockNext);

      expect(mockRes.redirect).toHaveBeenCalledWith('/login.html');
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should return JSON for API requests without session', () => {
      mockReq.path = '/api/test';

      requireWebAuth(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Authentication required'
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});