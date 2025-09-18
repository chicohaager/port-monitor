// Test fixtures for consistent test data

const samplePorts = [
  {
    port: 22,
    protocol: 'tcp',
    address: '0.0.0.0',
    state: 'LISTEN',
    process: 'sshd',
    pid: 1234,
    type: 'system'
  },
  {
    port: 80,
    protocol: 'tcp',
    address: '0.0.0.0',
    state: 'LISTEN',
    process: 'nginx',
    pid: 5678,
    type: 'system'
  },
  {
    port: 443,
    protocol: 'tcp',
    address: '0.0.0.0',
    state: 'LISTEN',
    process: 'nginx',
    pid: 5678,
    type: 'system'
  },
  {
    port: 3000,
    protocol: 'tcp',
    address: '127.0.0.1',
    state: 'LISTEN',
    process: 'node',
    pid: 9012,
    type: 'user'
  },
  {
    port: 3306,
    protocol: 'tcp',
    address: '127.0.0.1',
    state: 'LISTEN',
    process: 'mysqld',
    pid: 3456,
    type: 'system'
  },
  {
    port: 53,
    protocol: 'udp',
    address: '127.0.0.1',
    state: 'UNCONN',
    process: 'systemd-resolved',
    pid: 7890,
    type: 'system'
  }
];

const sampleSecurityAlerts = [
  {
    type: 'process_mismatch',
    severity: 'critical',
    message: 'Unexpected process on critical port',
    port: 23,
    process: 'unknown-telnet',
    address: '0.0.0.0',
    service: 'Telnet',
    category: 'dangerous',
    recommendations: [
      'Close port immediately',
      'Terminate process',
      'Check system for compromise'
    ],
    timestamp: '2024-01-01T12:00:00.000Z',
    details: {
      description: 'Telnet protocol - unsecure',
      risk: 'critical',
      isDangerous: true,
      isDevelopment: false,
      isDatabase: false,
      processMatch: false
    }
  },
  {
    type: 'unknown_process',
    severity: 'medium',
    message: 'Unknown process on port',
    port: 12345,
    process: 'custom-app',
    address: '0.0.0.0',
    service: 'Unknown',
    category: 'unknown',
    recommendations: [
      'Identify process',
      'Check legitimacy',
      'Add to whitelist if needed'
    ],
    timestamp: '2024-01-01T12:01:00.000Z',
    details: {
      description: 'Unknown service',
      risk: 'medium',
      isDangerous: false,
      isDevelopment: false,
      isDatabase: false,
      processMatch: false
    }
  },
  {
    type: 'development_port',
    severity: 'medium',
    message: 'Development port in production environment',
    port: 3000,
    process: 'node',
    address: '127.0.0.1',
    service: 'Node.js Development Server',
    category: 'development',
    recommendations: [
      'Configure port for production',
      'Terminate development server',
      'Use reverse proxy'
    ],
    timestamp: '2024-01-01T12:02:00.000Z',
    details: {
      description: 'Development server',
      risk: 'medium',
      isDangerous: false,
      isDevelopment: true,
      isDatabase: false,
      processMatch: true
    }
  }
];

const sampleConnections = [
  {
    localAddress: '192.168.1.100',
    localPort: 22,
    remoteAddress: '192.168.1.200',
    remotePort: 12345,
    state: 'ESTABLISHED'
  },
  {
    localAddress: '192.168.1.100',
    localPort: 80,
    remoteAddress: '192.168.1.201',
    remotePort: 54321,
    state: 'ESTABLISHED'
  },
  {
    localAddress: '127.0.0.1',
    localPort: 3000,
    remoteAddress: '127.0.0.1',
    remotePort: 45678,
    state: 'ESTABLISHED'
  }
];

const sampleDockerContainers = [
  {
    id: 'abc123def456',
    name: 'nginx-container',
    image: 'nginx:latest',
    state: 'running',
    status: 'Up 2 hours',
    ports: [
      {
        containerPort: 80,
        hostPort: 8080,
        protocol: 'tcp'
      }
    ]
  },
  {
    id: 'def456ghi789',
    name: 'mysql-container',
    image: 'mysql:8.0',
    state: 'running',
    status: 'Up 1 day',
    ports: [
      {
        containerPort: 3306,
        hostPort: 3306,
        protocol: 'tcp'
      }
    ]
  }
];

const sampleTrafficData = {
  timeline: [
    {
      timestamp: '2024-01-01T12:00:00.000Z',
      bytesIn: 1024000,
      bytesOut: 512000,
      packetsIn: 1000,
      packetsOut: 800,
      activeConnections: 15
    },
    {
      timestamp: '2024-01-01T12:01:00.000Z',
      bytesIn: 1100000,
      bytesOut: 550000,
      packetsIn: 1100,
      packetsOut: 850,
      activeConnections: 18
    },
    {
      timestamp: '2024-01-01T12:02:00.000Z',
      bytesIn: 980000,
      bytesOut: 490000,
      packetsIn: 950,
      packetsOut: 780,
      activeConnections: 12
    }
  ],
  summary: {
    totalBytesIn: 3104000,
    totalBytesOut: 1552000,
    totalPacketsIn: 3050,
    totalPacketsOut: 2430,
    avgActiveConnections: 15,
    peakConnections: 18,
    peakTimestamp: '2024-01-01T12:01:00.000Z'
  }
};

const sampleUsers = {
  admin: {
    username: 'admin',
    password: 'zimaos2024',
    role: 'admin'
  },
  user: {
    username: 'user',
    password: 'password123',
    role: 'user'
  },
  viewer: {
    username: 'viewer',
    password: 'view123',
    role: 'viewer'
  }
};

const sampleSessions = [
  {
    token: 'abc123def456ghi789',
    username: 'admin',
    role: 'admin',
    createdAt: new Date('2024-01-01T10:00:00.000Z'),
    lastAccess: new Date('2024-01-01T12:00:00.000Z'),
    expiresAt: new Date('2024-01-02T10:00:00.000Z')
  },
  {
    token: 'def456ghi789jkl012',
    username: 'user',
    role: 'user',
    createdAt: new Date('2024-01-01T11:00:00.000Z'),
    lastAccess: new Date('2024-01-01T11:30:00.000Z'),
    expiresAt: new Date('2024-01-02T11:00:00.000Z')
  }
];

// Command outputs for testing parsers
const sampleCommandOutputs = {
  ssOutput: `tcp   LISTEN 0      128          0.0.0.0:22             0.0.0.0:*    users:(("sshd",pid=1234,fd=3))
tcp   LISTEN 0      128          0.0.0.0:80             0.0.0.0:*    users:(("nginx",pid=5678,fd=4))
tcp   LISTEN 0      128          0.0.0.0:443            0.0.0.0:*    users:(("nginx",pid=5678,fd=5))
tcp   LISTEN 0      128          127.0.0.1:3000         0.0.0.0:*    users:(("node",pid=9012,fd=6))
tcp   LISTEN 0      128          127.0.0.1:3306         0.0.0.0:*    users:(("mysqld",pid=3456,fd=7))
udp   UNCONN 0      0            127.0.0.1:53           0.0.0.0:*    users:(("systemd-resolved",pid=7890,fd=8))`,

  netstatOutput: `tcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN      1234/sshd
tcp        0      0 0.0.0.0:80              0.0.0.0:*               LISTEN      5678/nginx
tcp        0      0 0.0.0.0:443             0.0.0.0:*               LISTEN      5678/nginx
tcp        0      0 127.0.0.1:3000          0.0.0.0:*               LISTEN      9012/node
tcp        0      0 127.0.0.1:3306          0.0.0.0:*               LISTEN      3456/mysqld
udp        0      0 127.0.0.1:53            0.0.0.0:*                           7890/systemd-resolved`,

  connectionsOutput: `tcp                0      0 192.168.1.100:22        192.168.1.200:12345     ESTABLISHED
tcp                0      0 192.168.1.100:80        192.168.1.201:54321     ESTABLISHED
tcp                0      0 127.0.0.1:3000          127.0.0.1:45678         ESTABLISHED`,

  dockerOutput: `[
  {
    "Id": "abc123def456",
    "Names": ["/nginx-container"],
    "Image": "nginx:latest",
    "State": "running",
    "Status": "Up 2 hours",
    "Ports": [
      {
        "PrivatePort": 80,
        "PublicPort": 8080,
        "Type": "tcp"
      }
    ]
  },
  {
    "Id": "def456ghi789",
    "Names": ["/mysql-container"],
    "Image": "mysql:8.0",
    "State": "running",
    "Status": "Up 1 day",
    "Ports": [
      {
        "PrivatePort": 3306,
        "PublicPort": 3306,
        "Type": "tcp"
      }
    ]
  }
]`
};

module.exports = {
  samplePorts,
  sampleSecurityAlerts,
  sampleConnections,
  sampleDockerContainers,
  sampleTrafficData,
  sampleUsers,
  sampleSessions,
  sampleCommandOutputs
};