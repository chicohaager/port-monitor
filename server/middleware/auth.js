const crypto = require('crypto');
const logger = require('../utils/logger');

// Simple user store - in production, use a database
const users = {
    'admin': {
        username: 'admin',
        password: 'zimaos2024', // In production, use bcrypt hash
        role: 'admin'
    }
};

// Simple session store - in production, use Redis or database
const sessions = new Map();
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

class AuthMiddleware {
    constructor() {
        // Clean expired sessions every hour
        setInterval(() => this.cleanExpiredSessions(), 60 * 60 * 1000);
    }

    // Generate session token
    generateSessionToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    // Create session
    createSession(username) {
        const token = this.generateSessionToken();
        const session = {
            username,
            role: users[username]?.role || 'user',
            createdAt: new Date(),
            lastAccess: new Date(),
            expiresAt: new Date(Date.now() + SESSION_TIMEOUT)
        };

        sessions.set(token, session);
        logger.info(`Session created for user: ${username}`);
        return token;
    }

    // Validate session
    validateSession(token) {
        if (!token) return null;

        const session = sessions.get(token);
        if (!session) return null;

        // Check if session expired
        if (new Date() > session.expiresAt) {
            sessions.delete(token);
            return null;
        }

        // Update last access
        session.lastAccess = new Date();
        return session;
    }

    // Destroy session
    destroySession(token) {
        if (token && sessions.has(token)) {
            const session = sessions.get(token);
            sessions.delete(token);
            logger.info(`Session destroyed for user: ${session.username}`);
            return true;
        }
        return false;
    }

    // Clean expired sessions
    cleanExpiredSessions() {
        const now = new Date();
        let cleanedCount = 0;

        for (const [token, session] of sessions.entries()) {
            if (now > session.expiresAt) {
                sessions.delete(token);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            logger.info(`Cleaned ${cleanedCount} expired sessions`);
        }
    }

    // Authenticate user
    authenticateUser(username, password) {
        const user = users[username];
        if (!user) {
            logger.warn(`Login attempt with unknown user: ${username}`);
            return null;
        }

        // In production, use bcrypt.compare()
        if (user.password === password) {
            logger.info(`Successful login for user: ${username}`);
            return user;
        }

        logger.warn(`Failed login attempt for user: ${username}`);
        return null;
    }

    // Login endpoint handler
    async handleLogin(req, res) {
        try {
            const { username, password } = req.body;

            if (!username || !password) {
                return res.status(400).json({
                    success: false,
                    error: 'Username and password are required'
                });
            }

            const user = this.authenticateUser(username, password);
            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid credentials'
                });
            }

            // Create session
            const token = this.createSession(username);

            // Set session cookie
            res.cookie('session_token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: SESSION_TIMEOUT
            });

            res.json({
                success: true,
                message: 'Login successful',
                user: {
                    username: user.username,
                    role: user.role
                }
            });

        } catch (error) {
            logger.error('Login error:', error);
            res.status(500).json({
                success: false,
                error: 'Interner Serverfehler'
            });
        }
    }

    // Logout endpoint handler
    async handleLogout(req, res) {
        try {
            const token = req.cookies?.session_token;

            if (token) {
                this.destroySession(token);
            }

            res.clearCookie('session_token');
            res.json({
                success: true,
                message: 'Erfolgreich abgemeldet'
            });

        } catch (error) {
            logger.error('Logout error:', error);
            res.status(500).json({
                success: false,
                error: 'Interner Serverfehler'
            });
        }
    }

    // Check session endpoint handler
    async handleSessionCheck(req, res) {
        try {
            const token = req.cookies?.session_token;
            const session = this.validateSession(token);

            if (session) {
                res.json({
                    success: true,
                    authenticated: true,
                    user: {
                        username: session.username,
                        role: session.role
                    }
                });
            } else {
                res.json({
                    success: true,
                    authenticated: false
                });
            }

        } catch (error) {
            logger.error('Session check error:', error);
            res.status(500).json({
                success: false,
                error: 'Interner Serverfehler'
            });
        }
    }

    // Authentication middleware
    requireAuth(req, res, next) {
        const token = req.cookies?.session_token;
        const session = this.validateSession(token);

        if (!session) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        req.user = {
            username: session.username,
            role: session.role
        };

        next();
    }

    // Web authentication middleware (redirects to login)
    requireWebAuth(req, res, next) {
        const token = req.cookies?.session_token;
        const session = this.validateSession(token);

        if (!session) {
            // If it's an API request, return JSON
            if (req.path.startsWith('/api/')) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
            }

            // For web requests, redirect to login
            return res.redirect('/login.html');
        }

        req.user = {
            username: session.username,
            role: session.role
        };

        next();
    }

    // Get session stats for monitoring
    getSessionStats() {
        const now = new Date();
        let activeSessions = 0;
        let expiredSessions = 0;

        for (const session of sessions.values()) {
            if (now > session.expiresAt) {
                expiredSessions++;
            } else {
                activeSessions++;
            }
        }

        return {
            total: sessions.size,
            active: activeSessions,
            expired: expiredSessions
        };
    }
}

// Create singleton instance
const authMiddleware = new AuthMiddleware();

module.exports = {
    authMiddleware,
    requireAuth: (req, res, next) => authMiddleware.requireAuth(req, res, next),
    requireWebAuth: (req, res, next) => authMiddleware.requireWebAuth(req, res, next)
};