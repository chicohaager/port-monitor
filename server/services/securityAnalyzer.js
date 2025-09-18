const fs = require('fs').promises;
const path = require('path');
const { getPortInfo, generateSecurityAlert } = require('../data/portDatabase');

class SecurityAnalyzer {
    constructor() {
        this.whitelistPath = path.join(__dirname, '../../data/whitelist.json');
        this.suspiciousPatterns = [
            { pattern: /nc|netcat/i, severity: 'high', reason: 'Potential backdoor' },
            { pattern: /miner|xmrig/i, severity: 'critical', reason: 'Crypto miner detected' },
            { pattern: /telnet/i, severity: 'medium', reason: 'Insecure protocol' },
            { pattern: /torrent/i, severity: 'low', reason: 'P2P activity' }
        ];
        this.portScanThreshold = 10;
        this.connectionHistory = new Map();
    }

    async loadWhitelist() {
        try {
            const data = await fs.readFile(this.whitelistPath, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            return { ports: [], processes: [] };
        }
    }

    async saveWhitelist(whitelist) {
        const dir = path.dirname(this.whitelistPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(this.whitelistPath, JSON.stringify(whitelist, null, 2));
    }

    async addToWhitelist(port, process) {
        const whitelist = await this.loadWhitelist();
        if (!whitelist.ports.includes(port)) {
            whitelist.ports.push(port);
        }
        if (process && !whitelist.processes.includes(process)) {
            whitelist.processes.push(process);
        }
        await this.saveWhitelist(whitelist);
    }

    async removeFromWhitelist(port) {
        const whitelist = await this.loadWhitelist();
        whitelist.ports = whitelist.ports.filter(p => p !== port);
        await this.saveWhitelist(whitelist);
    }

    async analyzePorts(ports) {
        const whitelist = await this.loadWhitelist();
        const alerts = [];
        const currentTime = Date.now();

        for (const port of ports) {
            const portAlerts = [];

            // Skip whitelisted ports/processes
            if (whitelist.ports.includes(port.port) ||
                whitelist.processes.includes(port.process)) {
                continue;
            }

            // Generate comprehensive security alert using port database
            const securityAlert = generateSecurityAlert(
                port.port,
                port.protocol || 'tcp',
                port.process,
                port.address || 'unknown'
            );

            // Convert the detailed security alert to our alert format
            const detailedAlert = {
                type: securityAlert.type,
                severity: securityAlert.severity,
                message: securityAlert.message,
                port: port.port,
                process: port.process || 'unknown',
                address: port.address || 'unknown',
                service: securityAlert.service,
                category: securityAlert.category,
                recommendations: securityAlert.recommendations,
                portInfo: securityAlert.portInfo,
                timestamp: securityAlert.timestamp,
                details: {
                    description: securityAlert.portInfo.description,
                    risk: securityAlert.portInfo.risk,
                    isDangerous: securityAlert.portInfo.isDangerous,
                    isDevelopment: securityAlert.portInfo.isDevelopment,
                    isDatabase: securityAlert.portInfo.isDatabase,
                    processMatch: securityAlert.portInfo.processMatch
                }
            };

            portAlerts.push(detailedAlert);

            // Additional analysis for suspicious processes
            for (const suspiciousPattern of this.suspiciousPatterns) {
                if (port.process && suspiciousPattern.pattern.test(port.process)) {
                    portAlerts.push({
                        type: 'suspicious_process',
                        severity: suspiciousPattern.severity,
                        message: `${suspiciousPattern.reason}: ${port.process} on port ${port.port}`,
                        port: port.port,
                        process: port.process,
                        recommendations: ['Investigate the process further', 'Check for malware', 'Monitor network traffic']
                    });
                }
            }

            // Privilege violation check
            if (port.port < 1024 && port.process !== 'root' && port.pid) {
                portAlerts.push({
                    type: 'privilege_violation',
                    severity: 'high',
                    message: `Non-root process ${port.process} using privileged port ${port.port}`,
                    port: port.port,
                    process: port.process,
                    recommendations: ['Check process permissions', 'Check for privilege escalation', 'Analyze system security']
                });
            }

            alerts.push(...portAlerts);
        }

        const portScanAlert = this.detectPortScanning(ports);
        if (portScanAlert) {
            alerts.push(portScanAlert);
        }

        return alerts;
    }

    detectPortScanning(ports) {
        const currentTime = Date.now();
        const recentPorts = [];

        ports.forEach(port => {
            const key = `${port.port}_${port.protocol}`;
            const lastSeen = this.connectionHistory.get(key);

            if (!lastSeen || currentTime - lastSeen > 60000) {
                recentPorts.push(port.port);
            }

            this.connectionHistory.set(key, currentTime);
        });

        for (const [key, timestamp] of this.connectionHistory.entries()) {
            if (currentTime - timestamp > 300000) {
                this.connectionHistory.delete(key);
            }
        }

        if (recentPorts.length >= this.portScanThreshold) {
            return {
                type: 'port_scan',
                severity: 'critical',
                message: `Possible port scanning detected: ${recentPorts.length} new ports opened`,
                ports: recentPorts
            };
        }

        return null;
    }

    analyzeConnection(connection) {
        const alerts = [];

        const isPrivateIP = (ip) => {
            return ip.startsWith('192.168.') ||
                   ip.startsWith('10.') ||
                   ip.startsWith('172.') ||
                   ip === '127.0.0.1' ||
                   ip === '::1';
        };

        if (!isPrivateIP(connection.remoteIp)) {
            const geoip = require('geoip-lite');
            const geo = geoip.lookup(connection.remoteIp);

            if (geo) {
                connection.geoData = {
                    country: geo.country,
                    region: geo.region,
                    city: geo.city,
                    ll: geo.ll, // latitude, longitude
                    timezone: geo.timezone
                };

                // High-risk countries
                if (['CN', 'RU', 'KP', 'IR', 'BY'].includes(geo.country)) {
                    alerts.push({
                        type: 'suspicious_country',
                        severity: 'high',
                        message: `Connection from high-risk country: ${geo.country} (${geo.city || 'Unknown city'})`,
                        connection,
                        geoData: connection.geoData
                    });
                }

                // Medium-risk countries (VPN/proxy common)
                if (['VN', 'UA', 'BD', 'PK'].includes(geo.country)) {
                    alerts.push({
                        type: 'medium_risk_country',
                        severity: 'medium',
                        message: `Connection from medium-risk country: ${geo.country} (${geo.city || 'Unknown city'})`,
                        connection,
                        geoData: connection.geoData
                    });
                }
            }
        }

        return alerts;
    }

    async getGeoStats() {
        const geoip = require('geoip-lite');
        const connections = await this.getRecentConnections();
        const geoStats = {
            countries: {},
            cities: {},
            topCountries: [],
            topCities: [],
            riskLevels: {
                high: 0,
                medium: 0,
                low: 0
            }
        };

        connections.forEach(conn => {
            if (this.isPrivateIP(conn.remoteIp)) return;

            const geo = geoip.lookup(conn.remoteIp);
            if (geo) {
                // Country stats
                const country = geo.country;
                geoStats.countries[country] = (geoStats.countries[country] || 0) + 1;

                // City stats
                const cityKey = `${geo.city || 'Unknown'}, ${country}`;
                geoStats.cities[cityKey] = (geoStats.cities[cityKey] || 0) + 1;

                // Risk level stats
                if (['CN', 'RU', 'KP', 'IR', 'BY'].includes(country)) {
                    geoStats.riskLevels.high++;
                } else if (['VN', 'UA', 'BD', 'PK'].includes(country)) {
                    geoStats.riskLevels.medium++;
                } else {
                    geoStats.riskLevels.low++;
                }
            }
        });

        // Sort and get top countries/cities
        geoStats.topCountries = Object.entries(geoStats.countries)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([country, count]) => ({ country, count }));

        geoStats.topCities = Object.entries(geoStats.cities)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([city, count]) => ({ city, count }));

        return geoStats;
    }

    async getRecentConnections() {
        // This would typically fetch from database
        // For now, return mock data
        return [];
    }

    isPrivateIP(ip) {
        return ip.startsWith('192.168.') ||
               ip.startsWith('10.') ||
               ip.startsWith('172.') ||
               ip === '127.0.0.1' ||
               ip === '::1';
    }
}

module.exports = SecurityAnalyzer;