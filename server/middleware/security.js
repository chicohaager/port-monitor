const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// Rate limiting configuration
const createRateLimiter = (windowMs = 15 * 60 * 1000, max = 100) => {
    return rateLimit({
        windowMs,
        max,
        message: 'Too many requests from this IP, please try again later.',
        standardHeaders: true,
        legacyHeaders: false,
    });
};

// API rate limiters - More permissive for development
const apiLimiter = createRateLimiter(1 * 60 * 1000, 100); // 100 requests per 1 minute
const strictApiLimiter = createRateLimiter(1 * 60 * 1000, 50); // 50 requests per 1 minute

// Input validation middleware
const validateInput = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message
            });
        }
        next();
    };
};

// Sanitize input to prevent XSS
const sanitizeInput = (input) => {
    if (typeof input !== 'string') return input;
    return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
};

// Sanitization middleware
const sanitizeMiddleware = (req, res, next) => {
    const sanitizeObj = (obj) => {
        Object.keys(obj).forEach(key => {
            if (typeof obj[key] === 'string') {
                obj[key] = sanitizeInput(obj[key]);
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                sanitizeObj(obj[key]);
            }
        });
    };

    if (req.body) sanitizeObj(req.body);
    if (req.query) sanitizeObj(req.query);
    if (req.params) sanitizeObj(req.params);

    next();
};

// Security headers
const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "ws:", "wss:", "https://cdn.jsdelivr.net"],
        },
    },
    crossOriginEmbedderPolicy: false,
});

// Request ID middleware for logging
const requestId = (req, res, next) => {
    req.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    res.setHeader('X-Request-ID', req.id);
    next();
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
    console.error(`[${req.id}] Error:`, err);

    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV !== 'production';

    res.status(err.status || 500).json({
        success: false,
        error: isDevelopment ? err.message : 'Internal server error',
        requestId: req.id,
        ...(isDevelopment && { stack: err.stack })
    });
};

module.exports = {
    apiLimiter,
    strictApiLimiter,
    validateInput,
    sanitizeInput,
    sanitizeMiddleware,
    securityHeaders,
    requestId,
    errorHandler
};