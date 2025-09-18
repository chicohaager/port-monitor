const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');

class Database {
    constructor() {
        this.dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/portmonitor.db');
        this.db = null;
        this.statements = {};
    }

    async init() {
        const dir = path.dirname(this.dbPath);
        await fs.mkdir(dir, { recursive: true });

        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, async (err) => {
                if (err) {
                    logger.error('Database connection failed:', err);
                    reject(err);
                } else {
                    try {
                        // Enable WAL mode for better concurrency
                        await this.run('PRAGMA journal_mode = WAL');
                        await this.run('PRAGMA synchronous = NORMAL');
                        await this.run('PRAGMA cache_size = 10000');
                        await this.run('PRAGMA temp_store = MEMORY');

                        await this.createTables();
                        await this.prepareStatements();
                        logger.info('Database initialized successfully');
                        resolve();
                    } catch (error) {
                        logger.error('Database setup failed:', error);
                        reject(error);
                    }
                }
            });
        });
    }

    async createTables() {
        const tableQueries = [
            `CREATE TABLE IF NOT EXISTS port_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                port INTEGER NOT NULL,
                protocol TEXT NOT NULL,
                process TEXT,
                pid INTEGER,
                container TEXT,
                container_id TEXT
            )`,
            `CREATE TABLE IF NOT EXISTS traffic_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                port INTEGER NOT NULL,
                bytes_in INTEGER DEFAULT 0,
                bytes_out INTEGER DEFAULT 0,
                connections INTEGER DEFAULT 0,
                packets_in INTEGER DEFAULT 0,
                packets_out INTEGER DEFAULT 0
            )`,
            `CREATE TABLE IF NOT EXISTS security_alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                type TEXT NOT NULL,
                severity TEXT NOT NULL,
                message TEXT NOT NULL,
                port INTEGER,
                process TEXT,
                resolved BOOLEAN DEFAULT 0
            )`,
            `CREATE TABLE IF NOT EXISTS connections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                local_ip TEXT NOT NULL,
                local_port INTEGER NOT NULL,
                remote_ip TEXT NOT NULL,
                remote_port INTEGER NOT NULL,
                state TEXT NOT NULL,
                duration INTEGER
            )`
        ];

        const indexQueries = [
            `CREATE INDEX IF NOT EXISTS idx_port_snapshots_timestamp ON port_snapshots(timestamp)`,
            `CREATE INDEX IF NOT EXISTS idx_port_snapshots_port ON port_snapshots(port)`,
            `CREATE INDEX IF NOT EXISTS idx_traffic_stats_timestamp ON traffic_stats(timestamp)`,
            `CREATE INDEX IF NOT EXISTS idx_traffic_stats_port ON traffic_stats(port)`,
            `CREATE INDEX IF NOT EXISTS idx_security_alerts_timestamp ON security_alerts(timestamp)`,
            `CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON security_alerts(severity)`,
            `CREATE INDEX IF NOT EXISTS idx_connections_timestamp ON connections(timestamp)`,
            `CREATE INDEX IF NOT EXISTS idx_connections_ports ON connections(local_port, remote_port)`
        ];

        // Create tables first
        for (const query of tableQueries) {
            await this.run(query);
        }

        // Then create indexes
        for (const query of indexQueries) {
            await this.run(query).catch(err => {
                // Index might already exist, log but don't fail
                logger.debug('Index creation warning:', err.message);
            });
        }
    }

    async prepareStatements() {
        // Prepare frequently used statements for better performance
        this.statements.insertPort = this.db.prepare(
            `INSERT INTO port_snapshots (port, protocol, process, pid, container, container_id)
             VALUES (?, ?, ?, ?, ?, ?)`
        );

        this.statements.insertTraffic = this.db.prepare(
            `INSERT INTO traffic_stats (port, bytes_in, bytes_out, connections, packets_in, packets_out)
             VALUES (?, ?, ?, ?, ?, ?)`
        );

        this.statements.insertAlert = this.db.prepare(
            `INSERT INTO security_alerts (type, severity, message, port, process)
             VALUES (?, ?, ?, ?, ?)`
        );

        this.statements.insertConnection = this.db.prepare(
            `INSERT INTO connections (local_ip, local_port, remote_ip, remote_port, state)
             VALUES (?, ?, ?, ?, ?)`
        );
    }

    run(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(query, params, function(err) {
                if (err) {
                    logger.error('Database query failed:', { query, error: err });
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    get(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(query, params, (err, row) => {
                if (err) {
                    logger.error('Database get failed:', { query, error: err });
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    all(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(query, params, (err, rows) => {
                if (err) {
                    logger.error('Database all failed:', { query, error: err });
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async savePortSnapshot(ports) {
        if (!this.statements.insertPort) {
            logger.warn('Database not ready for port snapshot');
            return;
        }

        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');

                try {
                    ports.forEach(port => {
                        this.statements.insertPort.run(
                            port.port,
                            port.protocol,
                            port.process,
                            port.pid,
                            port.container,
                            port.containerId
                        );
                    });

                    this.db.run('COMMIT', (err) => {
                        if (err) {
                            this.db.run('ROLLBACK');
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                } catch (error) {
                    this.db.run('ROLLBACK');
                    logger.error('Port snapshot save failed:', error);
                    reject(error);
                }
            });
        });
    }

    async saveTrafficStats(stats) {
        if (!this.statements.insertTraffic) {
            logger.warn('Database not ready for traffic stats');
            return;
        }

        try {
            await this.statements.insertTraffic.run(
                stats.port,
                stats.bytesIn || 0,
                stats.bytesOut || 0,
                stats.connections || 0,
                stats.packetsIn || 0,
                stats.packetsOut || 0
            );
        } catch (error) {
            logger.error('Traffic stats save failed:', error);
        }
    }

    async saveSecurityAlert(alert) {
        if (!this.statements.insertAlert) {
            logger.warn('Database not ready for security alert');
            return;
        }

        try {
            await this.statements.insertAlert.run(
                alert.type,
                alert.severity,
                alert.message,
                alert.port,
                alert.process
            );
        } catch (error) {
            logger.error('Security alert save failed:', error);
        }
    }

    async saveConnection(connection) {
        if (!this.statements.insertConnection) {
            logger.warn('Database not ready for connection');
            return;
        }

        try {
            await this.statements.insertConnection.run(
                connection.localIp,
                connection.localPort,
                connection.remoteIp,
                connection.remotePort,
                connection.state
            );
        } catch (error) {
            logger.error('Connection save failed:', error);
        }
    }

    async getPortHistory(period = '24h') {
        const hoursMap = {
            '1h': 1,
            '24h': 24,
            '7d': 168,
            '30d': 720
        };

        const hours = hoursMap[period] || 24;

        const query = `
            SELECT port, protocol, process, container,
                   COUNT(*) as occurrences,
                   MIN(timestamp) as first_seen,
                   MAX(timestamp) as last_seen
            FROM port_snapshots
            WHERE timestamp > datetime('now', '-${hours} hours')
            GROUP BY port, protocol, process
            ORDER BY port
        `;

        try {
            return await this.all(query);
        } catch (error) {
            logger.error('Failed to get port history:', error);
            return [];
        }
    }

    async getTrafficHistory(port, period = '24h') {
        const hoursMap = {
            '1h': 1,
            '24h': 24,
            '7d': 168,
            '30d': 720
        };

        const hours = hoursMap[period] || 24;

        const query = `
            SELECT timestamp,
                   AVG(bytes_in) as avg_bytes_in,
                   AVG(bytes_out) as avg_bytes_out,
                   MAX(connections) as max_connections
            FROM traffic_stats
            WHERE port = ? AND timestamp > datetime('now', '-${hours} hours')
            GROUP BY strftime('%Y-%m-%d %H', timestamp)
            ORDER BY timestamp
        `;

        try {
            return await this.all(query, [port]);
        } catch (error) {
            logger.error('Failed to get traffic history:', error);
            return [];
        }
    }

    async getSecurityAlerts(resolved = false) {
        const query = `
            SELECT * FROM security_alerts
            WHERE resolved = ?
            ORDER BY timestamp DESC
            LIMIT 100
        `;

        try {
            return await this.all(query, [resolved ? 1 : 0]);
        } catch (error) {
            logger.error('Failed to get security alerts:', error);
            return [];
        }
    }

    async resolveAlert(alertId) {
        const query = `UPDATE security_alerts SET resolved = 1 WHERE id = ?`;

        try {
            return await this.run(query, [alertId]);
        } catch (error) {
            logger.error('Failed to resolve alert:', error);
            throw error;
        }
    }

    async getConnectionStats(period = '24h') {
        const hoursMap = {
            '1h': 1,
            '24h': 24,
            '7d': 168,
            '30d': 720
        };

        const hours = hoursMap[period] || 24;

        const query = `
            SELECT remote_ip,
                   COUNT(*) as count,
                   GROUP_CONCAT(DISTINCT local_port) as local_ports
            FROM connections
            WHERE timestamp > datetime('now', '-${hours} hours')
            GROUP BY remote_ip
            ORDER BY count DESC
            LIMIT 50
        `;

        try {
            return await this.all(query);
        } catch (error) {
            logger.error('Failed to get connection stats:', error);
            return [];
        }
    }

    async getTrafficAnalytics(period = '24h') {
        const periodMap = {
            '1h': 24,
            '24h': 24,
            '7d': 168,
            '30d': 720
        };

        const hours = periodMap[period] || 24;

        try {
            // Generate mock timeline data for demonstration
            const timeline = [];
            const dataPoints = Math.min(hours, 24);
            for (let i = dataPoints - 1; i >= 0; i--) {
                const time = new Date(Date.now() - i * 3600000);
                timeline.push({
                    time: time.toISOString(),
                    total_in: Math.floor(Math.random() * 5000000) + 1000000,
                    total_out: Math.floor(Math.random() * 5000000) + 1000000,
                    active_ports: Math.floor(Math.random() * 20) + 10
                });
            }

            const totalIn = timeline.reduce((sum, item) => sum + item.total_in, 0);
            const totalOut = timeline.reduce((sum, item) => sum + item.total_out, 0);
            const avgPorts = timeline.length > 0 ? Math.round(timeline.reduce((sum, item) => sum + item.active_ports, 0) / timeline.length) : 0;

            return {
                timeline: timeline,
                summary: {
                    totalTrafficIn: totalIn,
                    totalTrafficOut: totalOut,
                    avgActivePorts: avgPorts,
                    period
                }
            };
        } catch (error) {
            logger.error('Failed to get traffic analytics:', error);
            return { timeline: [], summary: { totalTrafficIn: 0, totalTrafficOut: 0, avgActivePorts: 0, period } };
        }
    }

    async getPortTrends(period = '24h') {
        try {
            // Generate mock port trends data
            const commonPorts = [
                { port: 80, process: 'nginx', protocol: 'tcp' },
                { port: 443, process: 'nginx', protocol: 'tcp' },
                { port: 3000, process: 'node', protocol: 'tcp' },
                { port: 22, process: 'sshd', protocol: 'tcp' },
                { port: 5432, process: 'postgres', protocol: 'tcp' },
                { port: 6379, process: 'redis', protocol: 'tcp' },
                { port: 3306, process: 'mysql', protocol: 'tcp' },
                { port: 8080, process: 'tomcat', protocol: 'tcp' },
                { port: 9090, process: 'prometheus', protocol: 'tcp' },
                { port: 53, process: 'systemd-resolve', protocol: 'udp' }
            ];

            const trends = commonPorts.map(portInfo => ({
                ...portInfo,
                frequency: Math.floor(Math.random() * 100) + 20,
                activity_ratio: Math.floor(Math.random() * 100) + 1,
                last_seen: new Date(Date.now() - Math.random() * 86400000).toISOString()
            }));

            return trends.sort((a, b) => b.frequency - a.frequency);
        } catch (error) {
            logger.error('Failed to get port trends:', error);
            return [];
        }
    }

    async cleanup(daysToKeep = 30) {
        const queries = [
            `DELETE FROM port_snapshots WHERE timestamp < datetime('now', '-${daysToKeep} days')`,
            `DELETE FROM traffic_stats WHERE timestamp < datetime('now', '-${daysToKeep} days')`,
            `DELETE FROM security_alerts WHERE resolved = 1 AND timestamp < datetime('now', '-${daysToKeep} days')`,
            `DELETE FROM connections WHERE timestamp < datetime('now', '-${daysToKeep} days')`,
            `VACUUM`
        ];

        for (const query of queries) {
            try {
                await this.run(query);
            } catch (error) {
                logger.error('Cleanup query failed:', { query, error });
            }
        }

        logger.info(`Database cleanup completed. Removed data older than ${daysToKeep} days`);
    }

    async close() {
        if (this.statements.insertPort) this.statements.insertPort.finalize();
        if (this.statements.insertTraffic) this.statements.insertTraffic.finalize();
        if (this.statements.insertAlert) this.statements.insertAlert.finalize();
        if (this.statements.insertConnection) this.statements.insertConnection.finalize();

        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err) {
                    logger.error('Failed to close database:', err);
                    reject(err);
                } else {
                    logger.info('Database connection closed');
                    resolve();
                }
            });
        });
    }
}

module.exports = Database;