const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const PortMonitor = require('./services/portMonitor-optimized');
const SecurityAnalyzer = require('./services/securityAnalyzer');
const DockerIntegration = require('./services/dockerIntegration');
const Database = require('./services/database');
const TrafficMonitor = require('./services/trafficMonitor');
const logger = require('./utils/logger');
const {
    apiLimiter,
    strictApiLimiter,
    sanitizeMiddleware,
    securityHeaders,
    requestId,
    errorHandler
} = require('./middleware/security');
const { authMiddleware, requireAuth, requireWebAuth } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({
    server,
    verifyClient: (info) => {
        // Add WebSocket authentication here if needed
        return true;
    }
});

const PORT = process.env.PORT || 3000;
const UPDATE_INTERVAL = parseInt(process.env.UPDATE_INTERVAL) || 10000;

// Apply security middleware
app.use(securityHeaders);
app.use(requestId);
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(sanitizeMiddleware);

// Authentication routes (public)
app.post('/api/auth/login', (req, res) => authMiddleware.handleLogin(req, res));
app.post('/api/auth/logout', (req, res) => authMiddleware.handleLogout(req, res));
app.get('/api/auth/check', (req, res) => authMiddleware.handleSessionCheck(req, res));

// Login page route - publicly accessible
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/login.html'));
});

// Protect main routes BEFORE static files
app.get('/', requireWebAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/index.html', requireWebAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Protect all other static files (place AFTER protected routes)
app.use(express.static(path.join(__dirname, '../public'), {
    maxAge: '1d',
    etag: true,
    // Add custom middleware for each static file request
    setHeaders: (res, path) => {
        // This won't work for authentication, we need a different approach
    }
}));

// Apply rate limiting to API routes
app.use('/api', apiLimiter);

// Protect all API routes (except auth routes)
app.use('/api', (req, res, next) => {
    // Skip auth routes
    if (req.path.startsWith('/auth/')) {
        return next();
    }

    // Apply authentication to all other API routes
    requireAuth(req, res, next);
});

// Initialize services
const portMonitor = new PortMonitor();
const securityAnalyzer = new SecurityAnalyzer();
const dockerIntegration = new DockerIntegration();
const database = new Database();
const trafficMonitor = new TrafficMonitor();

// Initialize database with retry logic
const initDatabase = async (retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            await database.init();
            logger.info('Database initialized successfully');
            return true;
        } catch (err) {
            logger.error(`Database initialization attempt ${i + 1} failed:`, err);
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }
    return false;
};

initDatabase();

// WebSocket connection management with heartbeat
const connectedClients = new Map();
const HEARTBEAT_INTERVAL = 30000;

function heartbeat() {
    this.isAlive = true;
}

wss.on('connection', (ws, req) => {
    const clientId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const clientIp = req.socket.remoteAddress;

    logger.info(`WebSocket client connected: ${clientId} from ${clientIp}`);

    ws.isAlive = true;
    ws.clientId = clientId;
    ws.on('pong', heartbeat);

    connectedClients.set(clientId, {
        ws,
        connectedAt: new Date(),
        ip: clientIp
    });

    ws.on('close', () => {
        connectedClients.delete(clientId);
        logger.info(`WebSocket client disconnected: ${clientId}`);
    });

    ws.on('error', (error) => {
        logger.error(`WebSocket error for client ${clientId}:`, error);
        connectedClients.delete(clientId);
    });

    // Send initial data
    sendInitialData(ws);
});

// WebSocket heartbeat to detect disconnected clients
const wsHeartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            logger.debug(`Terminating inactive WebSocket: ${ws.clientId}`);
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
    });
}, HEARTBEAT_INTERVAL);

// Optimized broadcast function with error handling
function broadcastUpdate(data) {
    const message = JSON.stringify(data);
    let successCount = 0;
    let failCount = 0;

    connectedClients.forEach((client, clientId) => {
        if (client.ws.readyState === WebSocket.OPEN) {
            try {
                client.ws.send(message);
                successCount++;
            } catch (error) {
                logger.error(`Failed to send to client ${clientId}:`, error);
                failCount++;
                connectedClients.delete(clientId);
            }
        }
    });

    if (failCount > 0) {
        logger.warn(`Broadcast: ${successCount} success, ${failCount} failed`);
    }
}

async function sendInitialData(ws) {
    try {
        const [ports, alerts] = await Promise.all([
            portMonitor.getActivePorts(),
            securityAnalyzer.analyzePorts(await portMonitor.getActivePorts())
        ]);

        ws.send(JSON.stringify({
            type: 'initial-data',
            data: { ports, alerts }
        }));
    } catch (error) {
        logger.error('Failed to send initial data:', error);
    }
}

// Optimized update function with concurrent data fetching
async function updatePortData() {
    try {
        logger.info('Starting port data update...');
        const startTime = Date.now();

        // Fetch data concurrently
        logger.info('Fetching port data...');
        const [ports, dockerContainers, traffic] = await Promise.all([
            portMonitor.getActivePorts(),
            dockerIntegration.getContainerPorts().catch(err => {
                logger.warn('Docker integration failed:', err.message);
                return [];
            }),
            trafficMonitor.getCurrentTraffic().catch(err => {
                logger.warn('Traffic monitoring failed:', err.message);
                return { interfaces: [], ports: [] };
            })
        ]);
        logger.info(`Fetched ${ports.length} ports`);

        // Enrich port data with Docker info
        const enrichedPorts = ports.map(port => {
            const container = dockerContainers.find(c => c.port === port.port);
            return {
                ...port,
                container: container ? container.name : null,
                containerId: container ? container.id : null
            };
        });

        // Analyze security in the background
        const alerts = await securityAnalyzer.analyzePorts(enrichedPorts);

        // Save to database asynchronously
        database.savePortSnapshot(enrichedPorts).catch(err => {
            logger.error('Failed to save port snapshot:', err);
        });

        // Broadcast update
        logger.info(`Broadcasting update to ${connectedClients.size} clients`);
        logger.info(`Alerts found: ${alerts.length}`);
        if (alerts.length > 0) {
            logger.info('Sample alert:', JSON.stringify(alerts[0], null, 2));
        }
        broadcastUpdate({
            type: 'port-update',
            data: {
                ports: enrichedPorts,
                alerts,
                traffic,
                timestamp: new Date().toISOString()
            }
        });

        const updateTime = Date.now() - startTime;
        if (updateTime > 1000) {
            logger.warn(`Port update took ${updateTime}ms`);
        }
    } catch (error) {
        logger.error('Error updating port data:', error);
    }
}

// API Routes with validation
app.get('/api/ports', async (req, res, next) => {
    try {
        const ports = await portMonitor.getActivePorts();
        const dockerContainers = await dockerIntegration.getContainerPorts().catch(() => []);

        const enrichedPorts = ports.map(port => {
            const container = dockerContainers.find(c => c.port === port.port);
            return {
                ...port,
                container: container ? container.name : null,
                containerId: container ? container.id : null
            };
        });

        res.json({ success: true, data: enrichedPorts });
    } catch (error) {
        next(error);
    }
});

app.get('/api/security/alerts', async (req, res, next) => {
    try {
        const ports = await portMonitor.getActivePorts();
        const alerts = await securityAnalyzer.analyzePorts(ports);
        res.json({ success: true, data: alerts });
    } catch (error) {
        next(error);
    }
});

app.get('/api/traffic/current', async (req, res, next) => {
    try {
        const traffic = await trafficMonitor.getCurrentTraffic();
        res.json({ success: true, data: traffic });
    } catch (error) {
        next(error);
    }
});

app.get('/api/traffic/:port', async (req, res, next) => {
    try {
        const port = parseInt(req.params.port);
        if (isNaN(port) || port < 1 || port > 65535) {
            return res.status(400).json({ success: false, error: 'Invalid port number' });
        }

        const { period = '24h' } = req.query;
        const validPeriods = ['1h', '24h', '7d', '30d'];

        if (!validPeriods.includes(period)) {
            return res.status(400).json({ success: false, error: 'Invalid period' });
        }

        const traffic = await trafficMonitor.getPortTraffic(port, period);
        res.json({ success: true, data: traffic });
    } catch (error) {
        next(error);
    }
});

app.get('/api/topology', async (req, res, next) => {
    try {
        const [ports, connections] = await Promise.all([
            portMonitor.getActivePorts(),
            portMonitor.getActiveConnections()
        ]);

        // Create unique nodes with protocol-specific IDs
        const nodeMap = new Map();
        ports.forEach(p => {
            const nodeId = `${p.port}-${p.protocol}`;
            nodeMap.set(nodeId, {
                id: nodeId,
                label: `${p.process} :${p.port}`,
                type: p.protocol,
                container: p.container
            });
        });

        // Create edges, ensuring both endpoints exist as nodes
        const validEdges = connections.filter(c => {
            const fromNode = `${c.localPort}-tcp`;
            const toNode = `${c.remotePort}-tcp`;
            return nodeMap.has(fromNode) || nodeMap.has(toNode);
        }).map(c => ({
            from: `${c.localPort}-tcp`,
            to: `${c.remotePort}-tcp`,
            label: c.state
        }));

        const topology = {
            nodes: Array.from(nodeMap.values()),
            edges: validEdges
        };

        res.json({ success: true, data: topology });
    } catch (error) {
        next(error);
    }
});

app.get('/api/history', async (req, res, next) => {
    try {
        const { period = '24h' } = req.query;
        const validPeriods = ['1h', '24h', '7d', '30d'];

        if (!validPeriods.includes(period)) {
            return res.status(400).json({ success: false, error: 'Invalid period' });
        }

        const history = await database.getPortHistory(period);
        res.json({ success: true, data: history });
    } catch (error) {
        next(error);
    }
});

app.post('/api/security/whitelist', strictApiLimiter, async (req, res, next) => {
    try {
        const { port, process } = req.body;

        if (!port || typeof port !== 'number' || port < 1 || port > 65535) {
            return res.status(400).json({ success: false, error: 'Invalid port number' });
        }

        if (process && typeof process !== 'string') {
            return res.status(400).json({ success: false, error: 'Invalid process name' });
        }

        await securityAnalyzer.addToWhitelist(port, process);
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

app.delete('/api/security/whitelist/:port', strictApiLimiter, async (req, res, next) => {
    try {
        const port = parseInt(req.params.port);

        if (isNaN(port) || port < 1 || port > 65535) {
            return res.status(400).json({ success: false, error: 'Invalid port number' });
        }

        await securityAnalyzer.removeFromWhitelist(port);
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// Docker API endpoints
app.get('/api/docker/containers', async (req, res, next) => {
    try {
        const containers = await dockerIntegration.getAllContainers();
        res.json({ success: true, data: containers });
    } catch (error) {
        next(error);
    }
});

app.get('/api/docker/containers/:id/logs', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { lines = 100 } = req.query;

        const logs = await dockerIntegration.getContainerLogs(id, parseInt(lines));
        res.json({ success: true, data: logs });
    } catch (error) {
        next(error);
    }
});

app.post('/api/docker/containers/:id/start', strictApiLimiter, async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await dockerIntegration.startContainer(id);

        if (result) {
            res.json({ success: true, message: 'Container started successfully' });
        } else {
            res.status(500).json({ success: false, error: 'Failed to start container' });
        }
    } catch (error) {
        next(error);
    }
});

app.post('/api/docker/containers/:id/stop', strictApiLimiter, async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await dockerIntegration.stopContainer(id);

        if (result) {
            res.json({ success: true, message: 'Container stopped successfully' });
        } else {
            res.status(500).json({ success: false, error: 'Failed to stop container' });
        }
    } catch (error) {
        next(error);
    }
});

app.post('/api/docker/containers/:id/restart', strictApiLimiter, async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await dockerIntegration.restartContainer(id);

        if (result) {
            res.json({ success: true, message: 'Container restarted successfully' });
        } else {
            res.status(500).json({ success: false, error: 'Failed to restart container' });
        }
    } catch (error) {
        next(error);
    }
});

app.get('/api/docker/containers/:id/stats', async (req, res, next) => {
    try {
        const { id } = req.params;
        const stats = await dockerIntegration.getContainerStats(id);
        res.json({ success: true, data: stats });
    } catch (error) {
        next(error);
    }
});

// Geographic statistics endpoint
app.get('/api/security/geo-stats', requireAuth, async (req, res, next) => {
    try {
        const geoStats = await securityAnalyzer.getGeoStats();
        res.json({ success: true, data: geoStats });
    } catch (error) {
        next(error);
    }
});

// Traffic analytics endpoints
app.get('/api/analytics/overview', async (req, res, next) => {
    try {
        const { period = '24h' } = req.query;
        const validPeriods = ['1h', '24h', '7d', '30d'];

        if (!validPeriods.includes(period)) {
            return res.status(400).json({ success: false, error: 'Invalid period' });
        }

        const analytics = await database.getTrafficAnalytics(period);
        res.json({ success: true, data: analytics });
    } catch (error) {
        next(error);
    }
});

app.get('/api/analytics/port-trends', async (req, res, next) => {
    try {
        const { period = '24h' } = req.query;
        const validPeriods = ['1h', '24h', '7d', '30d'];

        if (!validPeriods.includes(period)) {
            return res.status(400).json({ success: false, error: 'Invalid period' });
        }

        const trends = await database.getPortTrends(period);
        res.json({ success: true, data: trends });
    } catch (error) {
        next(error);
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        clients: connectedClients.size
    });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start periodic updates
const updateInterval = setInterval(updatePortData, UPDATE_INTERVAL);

// Initial update
updatePortData();

// Cleanup on shutdown
const cleanup = async () => {
    logger.info('Shutting down server...');

    clearInterval(updateInterval);
    clearInterval(wsHeartbeat);

    // Close WebSocket connections
    wss.clients.forEach((ws) => {
        ws.close();
    });

    // Close database connection
    await database.cleanup(30).catch(err => {
        logger.error('Database cleanup failed:', err);
    });

    // Rotate logs
    await logger.rotateLogs().catch(err => {
        logger.error('Log rotation failed:', err);
    });

    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
        logger.error('Forced shutdown');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    cleanup();
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection at:', promise, 'reason:', reason);
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    logger.info(`Port Monitor Server running on port ${PORT}`);
    logger.info(`WebSocket server ready`);
    logger.info(`Connected clients: ${connectedClients.size}`);
});