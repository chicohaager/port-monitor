const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const logger = require('../utils/logger');

class PortMonitor {
    constructor() {
        this.cachedPorts = [];
        this.cachedConnections = [];
        this.lastUpdate = 0;
        this.cacheTimeout = 5000; // 5 seconds cache
    }

    async getActivePorts() {
        try {
            // Use cache if recent
            if (Date.now() - this.lastUpdate < this.cacheTimeout && this.cachedPorts.length > 0) {
                return this.cachedPorts;
            }

            // Try ss first, fallback to netstat
            let output = '';
            try {
                // Try with sudo first for process information
                const { stdout } = await execPromise('sudo ss -tulpn 2>/dev/null || ss -tulpn 2>/dev/null');
                output = stdout;
                logger.debug('Using ss command output');
            } catch {
                try {
                    const { stdout } = await execPromise('sudo netstat -tulpn 2>/dev/null || netstat -tulpn 2>/dev/null');
                    output = stdout;
                    logger.debug('Using netstat command output');
                } catch (fallbackError) {
                    logger.error('Failed to get ports with both ss and netstat', fallbackError);
                    return this.cachedPorts; // Return cached data on failure
                }
            }

            const ports = this.parsePortOutput(output);
            this.cachedPorts = ports;
            this.lastUpdate = Date.now();

            return ports;
        } catch (error) {
            logger.error('Error getting active ports:', error);
            return this.cachedPorts;
        }
    }

    async getActiveConnections() {
        try {
            let output = '';
            try {
                const { stdout } = await execPromise('ss -tan state established 2>/dev/null');
                output = stdout;
            } catch {
                try {
                    const { stdout } = await execPromise('netstat -tan 2>/dev/null | grep ESTABLISHED');
                    output = stdout;
                } catch (fallbackError) {
                    logger.error('Failed to get connections', fallbackError);
                    return this.cachedConnections;
                }
            }

            const connections = this.parseConnectionOutput(output);
            this.cachedConnections = connections;
            return connections;
        } catch (error) {
            logger.error('Error getting active connections:', error);
            return this.cachedConnections;
        }
    }

    parsePortOutput(output) {
        const lines = output.split('\n').filter(line => line.trim());
        const ports = [];
        const seenPorts = new Set();

        for (const line of lines) {
            try {
                // Skip header lines
                if (line.includes('Proto') || line.includes('Active')) continue;

                let protocol, port, process, pid, address;

                // Detect protocol
                if (line.includes('tcp')) {
                    protocol = 'tcp';
                } else if (line.includes('udp')) {
                    protocol = 'udp';
                } else {
                    continue;
                }

                // Extract port - improved regex patterns
                const portPatterns = [
                    /(?:0\.0\.0\.0|127\.0\.0\.1|\*|::|\[::\]):(\d+)/,
                    /\s+(?:\d+\.){3}\d+:(\d+)\s+/,
                    /:(\d+)\s+(?:\d+\.){3}\d+:\*/
                ];

                let portFound = false;
                for (const pattern of portPatterns) {
                    const match = line.match(pattern);
                    if (match && match[1]) {
                        port = parseInt(match[1]);
                        portFound = true;
                        break;
                    }
                }

                if (!portFound || !port) continue;

                // Skip if already processed
                const portKey = `${protocol}-${port}`;
                if (seenPorts.has(portKey)) continue;
                seenPorts.add(portKey);

                // Extract process and PID - improved patterns
                const processPatterns = [
                    /users:\(\("([^"]+)",pid=(\d+)/,  // ss format with users
                    /(\d+)\/(\S+)/,                    // netstat format
                    /"([^"]+)",pid=(\d+)/,            // alternative ss format
                    /users:\(\("([^"]+)"/             // ss format without pid
                ];

                for (const pattern of processPatterns) {
                    const match = line.match(pattern);
                    if (match) {
                        if (pattern === processPatterns[1]) {
                            // netstat format: PID/process
                            pid = parseInt(match[1]);
                            process = match[2];
                        } else if (match[2]) {
                            // ss format with PID: process, PID
                            process = match[1];
                            pid = parseInt(match[2]);
                        } else {
                            // ss format without PID
                            process = match[1];
                        }
                        break;
                    }
                }

                // If no process found, try to identify by port
                if (!process && port) {
                    process = this.identifyPortService(port);
                }

                // Extract listening address
                const addressMatch = line.match(/((?:\d+\.){3}\d+|\*|::|\[::\]):(\d+)/);
                if (addressMatch) {
                    address = addressMatch[1] === '*' || addressMatch[1].includes('::')
                        ? '0.0.0.0'
                        : addressMatch[1];
                }

                ports.push({
                    port,
                    protocol,
                    process: process || 'unknown',
                    pid: pid || null,
                    address: address || '0.0.0.0',
                    timestamp: new Date().toISOString()
                });
            } catch (parseError) {
                logger.debug('Failed to parse line:', { line, error: parseError.message });
            }
        }

        return ports.sort((a, b) => a.port - b.port);
    }

    identifyPortService(port) {
        const wellKnownPorts = {
            22: 'ssh',
            53: 'dns',
            80: 'http',
            443: 'https',
            631: 'cups',
            3000: 'node',
            3306: 'mysql',
            5432: 'postgresql',
            6379: 'redis',
            8000: 'http-alt',
            8080: 'http-proxy',
            8888: 'http-alt',
            10486: 'vscode',
            27017: 'mongodb',
            53769: 'unknown'
        };
        return wellKnownPorts[port] || 'unknown';
    }

    parseConnectionOutput(output) {
        const lines = output.split('\n').filter(line => line.trim());
        const connections = [];

        for (const line of lines) {
            try {
                // Skip headers
                if (line.includes('Proto') || line.includes('Active')) continue;

                // Improved regex for connection parsing
                const connectionPattern = /([\d.]+|[\da-f:]+):(\d+)\s+([\d.]+|[\da-f:]+):(\d+)\s+(\w+)?/;
                const match = line.match(connectionPattern);

                if (match) {
                    connections.push({
                        localIp: match[1],
                        localPort: parseInt(match[2]),
                        remoteIp: match[3],
                        remotePort: parseInt(match[4]),
                        state: match[5] || 'ESTABLISHED',
                        timestamp: new Date().toISOString()
                    });
                }
            } catch (parseError) {
                logger.debug('Failed to parse connection line:', { line, error: parseError.message });
            }
        }

        return connections;
    }

    async getProcessDetails(pid) {
        if (!pid) return null;

        try {
            const [cmdlineResult, statusResult] = await Promise.all([
                execPromise(`cat /proc/${pid}/cmdline 2>/dev/null | tr '\\0' ' '`).catch(() => ({ stdout: '' })),
                execPromise(`cat /proc/${pid}/status 2>/dev/null | head -10`).catch(() => ({ stdout: '' }))
            ]);

            const nameMatch = statusResult.stdout.match(/Name:\s+(\S+)/);
            const uidMatch = statusResult.stdout.match(/Uid:\s+(\d+)/);

            return {
                pid,
                name: nameMatch ? nameMatch[1] : 'unknown',
                cmdline: cmdlineResult.stdout.trim() || 'N/A',
                uid: uidMatch ? parseInt(uidMatch[1]) : null
            };
        } catch (error) {
            logger.debug(`Failed to get process details for PID ${pid}:`, error.message);
            return null;
        }
    }

    async getPortStatistics(port) {
        try {
            // Get connection count and basic stats
            const { stdout: ssOutput } = await execPromise(
                `ss -tan sport = :${port} or dport = :${port} 2>/dev/null | wc -l`
            );

            const connectionCount = parseInt(ssOutput.trim()) - 1; // Subtract header line

            return {
                port,
                connections: Math.max(0, connectionCount),
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.debug(`Failed to get statistics for port ${port}:`, error.message);
            return {
                port,
                connections: 0,
                timestamp: new Date().toISOString()
            };
        }
    }

    clearCache() {
        this.cachedPorts = [];
        this.cachedConnections = [];
        this.lastUpdate = 0;
    }
}

module.exports = PortMonitor;