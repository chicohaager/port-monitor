const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class TrafficMonitor {
    constructor() {
        this.trafficCache = new Map();
        this.lastUpdate = Date.now();
    }

    async getCurrentTraffic() {
        try {
            const interfaces = await this.getNetworkInterfaces();
            const traffic = [];

            for (const iface of interfaces) {
                const stats = await this.getInterfaceStats(iface);
                if (stats) {
                    traffic.push(stats);
                }
            }

            const portTraffic = await this.getPortSpecificTraffic();
            return { interfaces: traffic, ports: portTraffic };
        } catch (error) {
            console.error('Error getting traffic data:', error);
            return { interfaces: [], ports: [] };
        }
    }

    async getNetworkInterfaces() {
        try {
            const { stdout } = await execPromise('ip -o link show | awk -F\': \' \'{print $2}\'');
            return stdout.split('\n')
                .filter(iface => iface && !iface.startsWith('lo'));
        } catch (error) {
            const { stdout } = await execPromise('ifconfig -a | grep "^[a-zA-Z]" | cut -d: -f1');
            return stdout.split('\n')
                .filter(iface => iface && iface !== 'lo');
        }
    }

    async getInterfaceStats(interfaceName) {
        try {
            const rxPath = `/sys/class/net/${interfaceName}/statistics/rx_bytes`;
            const txPath = `/sys/class/net/${interfaceName}/statistics/tx_bytes`;
            const rxPacketsPath = `/sys/class/net/${interfaceName}/statistics/rx_packets`;
            const txPacketsPath = `/sys/class/net/${interfaceName}/statistics/tx_packets`;

            const { stdout: rxBytes } = await execPromise(`cat ${rxPath} 2>/dev/null`);
            const { stdout: txBytes } = await execPromise(`cat ${txPath} 2>/dev/null`);
            const { stdout: rxPackets } = await execPromise(`cat ${rxPacketsPath} 2>/dev/null`);
            const { stdout: txPackets } = await execPromise(`cat ${txPacketsPath} 2>/dev/null`);

            const current = {
                interface: interfaceName,
                rxBytes: parseInt(rxBytes.trim()) || 0,
                txBytes: parseInt(txBytes.trim()) || 0,
                rxPackets: parseInt(rxPackets.trim()) || 0,
                txPackets: parseInt(txPackets.trim()) || 0,
                timestamp: Date.now()
            };

            const previous = this.trafficCache.get(interfaceName);
            if (previous) {
                const timeDiff = (current.timestamp - previous.timestamp) / 1000;
                current.rxRate = Math.max(0, (current.rxBytes - previous.rxBytes) / timeDiff);
                current.txRate = Math.max(0, (current.txBytes - previous.txBytes) / timeDiff);
                current.rxPacketRate = Math.max(0, (current.rxPackets - previous.rxPackets) / timeDiff);
                current.txPacketRate = Math.max(0, (current.txPackets - previous.txPackets) / timeDiff);
            } else {
                current.rxRate = 0;
                current.txRate = 0;
                current.rxPacketRate = 0;
                current.txPacketRate = 0;
            }

            this.trafficCache.set(interfaceName, current);
            return current;
        } catch (error) {
            return null;
        }
    }

    async getPortSpecificTraffic() {
        try {
            const { stdout } = await execPromise('ss -i -t -n state established 2>/dev/null');
            const lines = stdout.split('\n').slice(1);
            const portTraffic = new Map();

            lines.forEach(line => {
                if (!line.trim()) return;

                const portMatch = line.match(/:(\d+)\s/);
                if (!portMatch) return;

                const port = parseInt(portMatch[1]);

                const bytesMatch = line.match(/bytes_acked:(\d+)/);
                const bytesReceivedMatch = line.match(/bytes_received:(\d+)/);

                const traffic = portTraffic.get(port) || {
                    port,
                    connections: 0,
                    bytesSent: 0,
                    bytesReceived: 0
                };

                traffic.connections++;
                if (bytesMatch) {
                    traffic.bytesSent += parseInt(bytesMatch[1]);
                }
                if (bytesReceivedMatch) {
                    traffic.bytesReceived += parseInt(bytesReceivedMatch[1]);
                }

                portTraffic.set(port, traffic);
            });

            return Array.from(portTraffic.values());
        } catch (error) {
            return [];
        }
    }

    async getPortTraffic(port, period = '24h') {
        const cacheKey = `${port}_${period}`;
        const cached = this.trafficCache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < 60000) {
            return cached.data;
        }

        try {
            const { stdout } = await execPromise(
                `ss -i sport = :${port} or dport = :${port} 2>/dev/null`
            );

            let totalBytesIn = 0;
            let totalBytesOut = 0;
            let connectionCount = 0;

            const lines = stdout.split('\n');
            lines.forEach(line => {
                if (line.includes('bytes_acked')) {
                    const match = line.match(/bytes_acked:(\d+)/);
                    if (match) totalBytesOut += parseInt(match[1]);
                }
                if (line.includes('bytes_received')) {
                    const match = line.match(/bytes_received:(\d+)/);
                    if (match) totalBytesIn += parseInt(match[1]);
                }
                if (line.includes('ESTAB')) {
                    connectionCount++;
                }
            });

            const data = {
                port,
                bytesIn: totalBytesIn,
                bytesOut: totalBytesOut,
                connections: connectionCount,
                timestamp: new Date().toISOString()
            };

            this.trafficCache.set(cacheKey, {
                data,
                timestamp: Date.now()
            });

            return data;
        } catch (error) {
            console.error(`Error getting traffic for port ${port}:`, error);
            return {
                port,
                bytesIn: 0,
                bytesOut: 0,
                connections: 0,
                timestamp: new Date().toISOString()
            };
        }
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatRate(bytesPerSecond) {
        return this.formatBytes(bytesPerSecond) + '/s';
    }
}

module.exports = TrafficMonitor;