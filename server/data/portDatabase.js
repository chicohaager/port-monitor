const commonPorts = {
    // Web Services
    80: {
        service: 'HTTP',
        description: 'Hypertext Transfer Protocol - Unencrypted web traffic',
        protocol: 'tcp',
        risk: 'medium',
        category: 'web',
        recommendations: [
            'Use HTTPS (Port 443) instead of HTTP',
            'Implement Web Application Firewall (WAF)',
            'Monitor for unusual requests'
        ],
        commonProcesses: ['nginx', 'apache2', 'httpd', 'lighttpd']
    },
    443: {
        service: 'HTTPS',
        description: 'HTTP Secure - Encrypted web traffic',
        protocol: 'tcp',
        risk: 'low',
        category: 'web',
        recommendations: [
            'Ensure that strong TLS versions are used',
            'Use valid SSL/TLS certificates',
            'Enable HTTP Strict Transport Security (HSTS)'
        ],
        commonProcesses: ['nginx', 'apache2', 'httpd']
    },
    8080: {
        service: 'HTTP-Alt',
        description: 'Alternative HTTP Port - often for Development or Proxies',
        protocol: 'tcp',
        risk: 'medium',
        category: 'web',
        recommendations: [
            'Restrict access to necessary IPs',
            'Use authentication',
            'Monitor unauthorized access'
        ],
        commonProcesses: ['tomcat', 'jetty', 'node', 'python']
    },
    8000: {
        service: 'HTTP-Dev',
        description: 'Development HTTP Server',
        protocol: 'tcp',
        risk: 'high',
        category: 'development',
        recommendations: [
            'Use only for development',
            'Do not use in production environments',
            'Configure firewall rules for external access'
        ],
        commonProcesses: ['python', 'node', 'ruby', 'php']
    },

    // SSH & Remote Access
    22: {
        service: 'SSH',
        description: 'Secure Shell - Encrypted Remote-access',
        protocol: 'tcp',
        risk: 'medium',
        category: 'remote',
        recommendations: [
            'Use key-based authentication',
            'Disable root login',
            'Change default port',
            'Implement Fail2Ban'
        ],
        commonProcesses: ['sshd', 'openssh-server']
    },
    23: {
        service: 'Telnet',
        description: 'Telnet - INSECURE plaintext Remote-access',
        protocol: 'tcp',
        risk: 'critical',
        category: 'remote',
        recommendations: [
            'IMMEDIATELY DISABLE - Use SSH instead',
            'Change all passwords',
            'Check network for compromise'
        ],
        commonProcesses: ['telnetd', 'xinetd']
    },
    3389: {
        service: 'RDP',
        description: 'Remote Desktop Protocol - Windows Remote Desktop',
        protocol: 'tcp',
        risk: 'high',
        category: 'remote',
        recommendations: [
            'Use VPN for external access',
            'Enable Network Level Authentication',
            'Use strong passwords',
            'Monitor login attempts'
        ],
        commonProcesses: ['TermService', 'rdp']
    },

    // Databases
    3306: {
        service: 'MySQL',
        description: 'MySQL/MariaDB Database',
        protocol: 'tcp',
        risk: 'high',
        category: 'database',
        recommendations: [
            'Use strong passwords',
            'Restrict network access',
            'Enable SSL/TLS',
            'Regular Security Updates'
        ],
        commonProcesses: ['mysqld', 'mariadb']
    },
    5432: {
        service: 'PostgreSQL',
        description: 'PostgreSQL Database',
        protocol: 'tcp',
        risk: 'high',
        category: 'database',
        recommendations: [
            'Configure pg_hba.conf secure',
            'Use SSL connections',
            'Restrict network access',
            'Enable Logging'
        ],
        commonProcesses: ['postgres', 'postmaster']
    },
    27017: {
        service: 'MongoDB',
        description: 'MongoDB NoSQL Database',
        protocol: 'tcp',
        risk: 'high',
        category: 'database',
        recommendations: [
            'Enable authentication',
            'Use SSL/TLS',
            'Restrict network access',
            'Regular Backups'
        ],
        commonProcesses: ['mongod']
    },
    6379: {
        service: 'Redis',
        description: 'Redis In-Memory Database/Cache',
        protocol: 'tcp',
        risk: 'high',
        category: 'database',
        recommendations: [
            'Enable authentication (requirepass)',
            'Bind only to localhost',
            'Use firewall rules',
            'Disable dangerous commands'
        ],
        commonProcesses: ['redis-server']
    },

    // DNS
    53: {
        service: 'DNS',
        description: 'Domain Name System',
        protocol: 'both',
        risk: 'medium',
        category: 'network',
        recommendations: [
            'Restrict recursive queries',
            'Implement DNS filtering',
            'Monitor DNS tunneling',
            'Use DNS over HTTPS/TLS'
        ],
        commonProcesses: ['named', 'dnsmasq', 'systemd-resolved', 'unbound']
    },

    // FTP
    21: {
        service: 'FTP',
        description: 'File Transfer Protocol - INSECURE',
        protocol: 'tcp',
        risk: 'high',
        category: 'file',
        recommendations: [
            'Use SFTP or FTPS instead',
            'Restrict to internal networks',
            'Monitor file transfers',
            'Use strong authentication'
        ],
        commonProcesses: ['vsftpd', 'proftpd', 'ftpd']
    },
    22: {
        service: 'SFTP',
        description: 'SSH File Transfer Protocol - Secure file transfer',
        protocol: 'tcp',
        risk: 'low',
        category: 'file',
        recommendations: [
            'Use key-based authentication',
            'Restrict directory access (chroot)',
            'Monitor file transfers'
        ],
        commonProcesses: ['sshd']
    },

    // Mail
    25: {
        service: 'SMTP',
        description: 'Simple Mail Transfer Protocol',
        protocol: 'tcp',
        risk: 'medium',
        category: 'mail',
        recommendations: [
            'Use STARTTLS',
            'Implement SPF/DKIM/DMARC',
            'Monitor for spam/relay abuse',
            'Enable authentication'
        ],
        commonProcesses: ['postfix', 'sendmail', 'exim']
    },
    587: {
        service: 'SMTP-Auth',
        description: 'SMTP with authentication (Submission)',
        protocol: 'tcp',
        risk: 'low',
        category: 'mail',
        recommendations: [
            'Enforce STARTTLS',
            'Use strong authentication',
            'Implement rate limiting'
        ],
        commonProcesses: ['postfix', 'exim']
    },
    993: {
        service: 'IMAPS',
        description: 'IMAP over SSL - Secure mail retrieval',
        protocol: 'tcp',
        risk: 'low',
        category: 'mail',
        recommendations: [
            'Use strong TLS versions',
            'Implement two-factor authentication',
            'Monitor login attempts'
        ],
        commonProcesses: ['dovecot', 'courier-imap']
    },

    // Development & Monitoring
    3000: {
        service: 'Node.js Dev',
        description: 'Node.js Development Server',
        protocol: 'tcp',
        risk: 'medium',
        category: 'development',
        recommendations: [
            'Use only for development',
            'Restrict network access',
            'Use environment variables for secrets'
        ],
        commonProcesses: ['node', 'npm', 'yarn']
    },
    9090: {
        service: 'Prometheus',
        description: 'Prometheus Monitoring',
        protocol: 'tcp',
        risk: 'medium',
        category: 'monitoring',
        recommendations: [
            'Restrict access to monitoring network',
            'Use authentication',
            'Monitor sensitive metrics'
        ],
        commonProcesses: ['prometheus']
    },
    3001: {
        service: 'Grafana',
        description: 'Grafana Dashboard',
        protocol: 'tcp',
        risk: 'medium',
        category: 'monitoring',
        recommendations: [
            'Use strong admin passwords',
            'Enable HTTPS',
            'Restrict dashboard access'
        ],
        commonProcesses: ['grafana-server']
    },

    // Network Services
    161: {
        service: 'SNMP',
        description: 'Simple Network Management Protocol',
        protocol: 'udp',
        risk: 'high',
        category: 'network',
        recommendations: [
            'Use SNMPv3 with encryption',
            'Change default community strings',
            'Restrict access via firewall',
            'Monitor SNMP queries'
        ],
        commonProcesses: ['snmpd']
    },
    5353: {
        service: 'mDNS',
        description: 'Multicast DNS (Bonjour/Avahi)',
        protocol: 'udp',
        risk: 'low',
        category: 'network',
        recommendations: [
            'Disable if not needed',
            'Restrict to local networks',
            'Monitor mDNS-traffic'
        ],
        commonProcesses: ['avahi-daemon', 'mDNSResponder']
    },

    // High-Risk Services
    135: {
        service: 'MS-RPC',
        description: 'Microsoft RPC Endpoint Mapper',
        protocol: 'tcp',
        risk: 'critical',
        category: 'windows',
        recommendations: [
            'Block external access',
            'Keep Windows-Updates up to date',
            'Monitor RPC-traffic',
            'Use Windows Firewall'
        ],
        commonProcesses: ['svchost.exe']
    },
    445: {
        service: 'SMB',
        description: 'Server Message Block - Windows file sharing',
        protocol: 'tcp',
        risk: 'critical',
        category: 'file',
        recommendations: [
            'Block external access IMMEDIATELY',
            'Disable SMBv1',
            'Use strong authentication',
            'Monitor file shares'
        ],
        commonProcesses: ['smbd', 'System']
    }
};

const dangerousPorts = [23, 135, 139, 445, 1433, 1521, 2049, 3389, 5900, 5984, 6000, 8080, 8888, 9200];
const developmentPorts = [3000, 3001, 4000, 5000, 8000, 8080, 8888, 9000];
const databasePorts = [1433, 1521, 3306, 5432, 6379, 27017, 28017];

function getPortInfo(port, protocol, process) {
    const portInfo = commonPorts[port];

    if (portInfo) {
        return {
            ...portInfo,
            isKnown: true,
            isDangerous: dangerousPorts.includes(port),
            isDevelopment: developmentPorts.includes(port),
            isDatabase: databasePorts.includes(port),
            processMatch: portInfo.commonProcesses.some(p =>
                process && process.toLowerCase().includes(p.toLowerCase())
            )
        };
    }

    // Unknown port analysis
    let risk = 'low';
    let category = 'unknown';
    let recommendations = ['Identify the service', 'Check if the port is needed'];

    if (port < 1024) {
        risk = 'medium';
        recommendations.push('System port - check privileged processes');
    }

    if (port >= 49152) {
        risk = 'low';
        category = 'dynamic';
        recommendations.push('Dynamic port - temporary connection');
    }

    if (dangerousPorts.includes(port)) {
        risk = 'critical';
        recommendations.push('CRITICAL: Known dangerous port');
    }

    return {
        service: 'Unknown',
        description: `Unknown service on port ${port}`,
        protocol: protocol,
        risk: risk,
        category: category,
        recommendations: recommendations,
        isKnown: false,
        isDangerous: dangerousPorts.includes(port),
        isDevelopment: developmentPorts.includes(port),
        isDatabase: databasePorts.includes(port),
        processMatch: false
    };
}

function generateSecurityAlert(port, protocol, process, address = 'unknown') {
    const portInfo = getPortInfo(port, protocol, process);

    let severity = 'low';
    let type = 'info';
    let message = '';

    // Determine severity based on port info and context
    if (portInfo.isDangerous) {
        severity = 'critical';
        type = 'dangerous_port';
        message = `CRITICAL: Dangerous service ${portInfo.service} detected on port ${port}`;
    } else if (!portInfo.isKnown) {
        severity = 'medium';
        type = 'unknown_port';
        message = `Unknown service on port ${port} (${protocol.toUpperCase()})`;
    } else if (portInfo.risk === 'high') {
        severity = 'high';
        type = 'high_risk_service';
        message = `High-risk service ${portInfo.service} on port ${port}`;
    } else if (portInfo.isDevelopment && address !== '127.0.0.1' && address !== 'localhost') {
        severity = 'high';
        type = 'dev_service_exposed';
        message = `Development service ${portInfo.service} exposed to external connections`;
    } else if (!portInfo.processMatch && process) {
        severity = 'medium';
        type = 'process_mismatch';
        message = `Unexpected process "${process}" on ${portInfo.service} port ${port}`;
    } else {
        severity = 'low';
        type = 'info';
        message = `${portInfo.service} service active on port ${port}`;
    }

    return {
        type,
        severity,
        message,
        port,
        process: process || 'unknown',
        address,
        service: portInfo.service,
        category: portInfo.category,
        recommendations: portInfo.recommendations,
        portInfo: portInfo,
        timestamp: new Date().toISOString()
    };
}

module.exports = {
    commonPorts,
    getPortInfo,
    generateSecurityAlert,
    dangerousPorts,
    developmentPorts,
    databasePorts
};