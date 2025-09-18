const PortMonitor = require('../../server/services/portMonitor-optimized');

// Mock child_process
jest.mock('child_process', () => ({
  exec: jest.fn()
}));

// Mock util.promisify
jest.mock('util', () => ({
  promisify: jest.fn((fn) => jest.fn())
}));

describe('PortMonitor', () => {
  let portMonitor;
  let mockExecPromise;

  beforeEach(() => {
    mockExecPromise = jest.fn();
    require('util').promisify.mockReturnValue(mockExecPromise);

    portMonitor = new PortMonitor();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with default values', () => {
      expect(portMonitor.cachedPorts).toEqual([]);
      expect(portMonitor.cachedConnections).toEqual([]);
      expect(portMonitor.lastUpdate).toBe(0);
      expect(portMonitor.lastConnectionUpdate).toBe(0);
      expect(portMonitor.cacheTimeout).toBe(5000);
    });
  });

  describe('parsePortOutput', () => {
    test('should parse ss command output correctly', () => {
      const ssOutput = `tcp   LISTEN 0      128          0.0.0.0:22             0.0.0.0:*    users:(("sshd",pid=1234,fd=3))
tcp   LISTEN 0      128          0.0.0.0:80             0.0.0.0:*    users:(("nginx",pid=5678,fd=4))
udp   UNCONN 0      0            127.0.0.1:53           0.0.0.0:*    users:(("systemd-resolved",pid=9012,fd=5))`;

      const result = portMonitor.parsePortOutput(ssOutput);

      expect(result).toHaveLength(3);

      expect(result[0]).toMatchObject({
        port: 22,
        protocol: 'tcp',
        address: '0.0.0.0',
        state: 'LISTEN',
        process: 'sshd',
        pid: 1234
      });

      expect(result[1]).toMatchObject({
        port: 80,
        protocol: 'tcp',
        address: '0.0.0.0',
        state: 'LISTEN',
        process: 'nginx',
        pid: 5678
      });

      expect(result[2]).toMatchObject({
        port: 53,
        protocol: 'udp',
        address: '127.0.0.1',
        state: 'UNCONN',
        process: 'systemd-resolved',
        pid: 9012
      });
    });

    test('should parse netstat command output correctly', () => {
      const netstatOutput = `tcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN      1234/sshd
tcp        0      0 0.0.0.0:80              0.0.0.0:*               LISTEN      5678/nginx
udp        0      0 127.0.0.1:53            0.0.0.0:*                           9012/systemd-resolved`;

      const result = portMonitor.parsePortOutput(netstatOutput);

      expect(result).toHaveLength(3);

      expect(result[0]).toMatchObject({
        port: 22,
        protocol: 'tcp',
        address: '0.0.0.0',
        state: 'LISTEN',
        process: 'sshd',
        pid: 1234
      });

      expect(result[1]).toMatchObject({
        port: 80,
        protocol: 'tcp',
        address: '0.0.0.0',
        state: 'LISTEN',
        process: 'nginx',
        pid: 5678
      });

      expect(result[2]).toMatchObject({
        port: 53,
        protocol: 'udp',
        address: '127.0.0.1',
        process: 'systemd-resolved',
        pid: 9012
      });
    });

    test('should handle output without process information', () => {
      const outputWithoutProcess = `tcp   LISTEN 0      128          0.0.0.0:22             0.0.0.0:*
tcp   LISTEN 0      128          0.0.0.0:80             0.0.0.0:*`;

      const result = portMonitor.parsePortOutput(outputWithoutProcess);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        port: 22,
        protocol: 'tcp',
        address: '0.0.0.0',
        state: 'LISTEN',
        process: 'UNKNOWN',
        pid: null
      });
    });

    test('should identify port types correctly', () => {
      const output = `tcp   LISTEN 0      128          0.0.0.0:22             0.0.0.0:*    users:(("sshd",pid=1234,fd=3))
tcp   LISTEN 0      128          127.0.0.1:3000         0.0.0.0:*    users:(("node",pid=5678,fd=4))
tcp   LISTEN 0      128          0.0.0.0:3306           0.0.0.0:*    users:(("mysqld",pid=9012,fd=5))`;

      const result = portMonitor.parsePortOutput(output);

      expect(result[0].type).toBe('system'); // SSH
      expect(result[1].type).toBe('user');   // Node.js app
      expect(result[2].type).toBe('system'); // MySQL
    });

    test('should handle malformed lines gracefully', () => {
      const malformedOutput = `tcp   LISTEN 0      128          0.0.0.0:22             0.0.0.0:*    users:(("sshd",pid=1234,fd=3))
invalid line that should be ignored
tcp   LISTEN 0      128          0.0.0.0:80             0.0.0.0:*    users:(("nginx",pid=5678,fd=4))
another invalid line`;

      const result = portMonitor.parsePortOutput(malformedOutput);

      expect(result).toHaveLength(2);
      expect(result[0].port).toBe(22);
      expect(result[1].port).toBe(80);
    });

    test('should remove duplicate ports', () => {
      const duplicateOutput = `tcp   LISTEN 0      128          0.0.0.0:22             0.0.0.0:*    users:(("sshd",pid=1234,fd=3))
tcp   LISTEN 0      128          127.0.0.1:22           0.0.0.0:*    users:(("sshd",pid=1234,fd=4))
tcp   LISTEN 0      128          0.0.0.0:80             0.0.0.0:*    users:(("nginx",pid=5678,fd=5))`;

      const result = portMonitor.parsePortOutput(duplicateOutput);

      expect(result).toHaveLength(2);
      const ports = result.map(p => p.port);
      expect(ports).toContain(22);
      expect(ports).toContain(80);
    });
  });

  describe('getActivePorts', () => {
    test('should return cached ports when cache is valid', async () => {
      const cachedPorts = [{ port: 22, protocol: 'tcp' }];
      portMonitor.cachedPorts = cachedPorts;
      portMonitor.lastUpdate = Date.now() - 1000; // 1 second ago

      const result = await portMonitor.getActivePorts();

      expect(result).toEqual(cachedPorts);
      expect(mockExecPromise).not.toHaveBeenCalled();
    });

    test('should fetch fresh data when cache is expired', async () => {
      const ssOutput = `tcp   LISTEN 0      128          0.0.0.0:22             0.0.0.0:*    users:(("sshd",pid=1234,fd=3))`;

      mockExecPromise.mockResolvedValueOnce({ stdout: ssOutput });

      portMonitor.lastUpdate = Date.now() - 10000; // 10 seconds ago (expired)

      const result = await portMonitor.getActivePorts();

      expect(mockExecPromise).toHaveBeenCalledWith('ss -tulpn 2>/dev/null');
      expect(result).toHaveLength(1);
      expect(result[0].port).toBe(22);
    });

    test('should fallback to netstat when ss fails', async () => {
      const netstatOutput = `tcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN      1234/sshd`;

      mockExecPromise
        .mockRejectedValueOnce(new Error('ss command failed'))
        .mockResolvedValueOnce({ stdout: netstatOutput });

      const result = await portMonitor.getActivePorts();

      expect(mockExecPromise).toHaveBeenCalledWith('ss -tulpn 2>/dev/null');
      expect(mockExecPromise).toHaveBeenCalledWith('netstat -tulpn 2>/dev/null');
      expect(result).toHaveLength(1);
      expect(result[0].port).toBe(22);
    });

    test('should return cached data when both commands fail', async () => {
      const cachedPorts = [{ port: 22, protocol: 'tcp' }];
      portMonitor.cachedPorts = cachedPorts;

      mockExecPromise
        .mockRejectedValueOnce(new Error('ss command failed'))
        .mockRejectedValueOnce(new Error('netstat command failed'));

      const result = await portMonitor.getActivePorts();

      expect(result).toEqual(cachedPorts);
    });
  });

  describe('parseConnectionOutput', () => {
    test('should parse connection output correctly', () => {
      const connectionOutput = `tcp                0      0 192.168.1.100:22        192.168.1.200:12345     ESTABLISHED
tcp                0      0 192.168.1.100:80        192.168.1.201:54321     ESTABLISHED
tcp                0      0 127.0.0.1:3000          127.0.0.1:45678         ESTABLISHED`;

      const result = portMonitor.parseConnectionOutput(connectionOutput);

      expect(result).toHaveLength(3);

      expect(result[0]).toMatchObject({
        localAddress: '192.168.1.100',
        localPort: 22,
        remoteAddress: '192.168.1.200',
        remotePort: 12345,
        state: 'ESTABLISHED'
      });

      expect(result[1]).toMatchObject({
        localAddress: '192.168.1.100',
        localPort: 80,
        remoteAddress: '192.168.1.201',
        remotePort: 54321,
        state: 'ESTABLISHED'
      });
    });

    test('should handle malformed connection lines', () => {
      const malformedOutput = `tcp                0      0 192.168.1.100:22        192.168.1.200:12345     ESTABLISHED
invalid connection line
tcp                0      0 192.168.1.100:80        192.168.1.201:54321     ESTABLISHED`;

      const result = portMonitor.parseConnectionOutput(malformedOutput);

      expect(result).toHaveLength(2);
    });
  });

  describe('getActiveConnections', () => {
    test('should return cached connections when cache is valid', async () => {
      const cachedConnections = [{ localPort: 22, remotePort: 12345 }];
      portMonitor.cachedConnections = cachedConnections;
      portMonitor.lastConnectionUpdate = Date.now() - 1000;

      const result = await portMonitor.getActiveConnections();

      expect(result).toEqual(cachedConnections);
      expect(mockExecPromise).not.toHaveBeenCalled();
    });

    test('should fetch fresh connections when cache is expired', async () => {
      const connectionOutput = `tcp                0      0 192.168.1.100:22        192.168.1.200:12345     ESTABLISHED`;

      mockExecPromise.mockResolvedValueOnce({ stdout: connectionOutput });

      portMonitor.lastConnectionUpdate = Date.now() - 10000;

      const result = await portMonitor.getActiveConnections();

      expect(mockExecPromise).toHaveBeenCalledWith('ss -tan state established 2>/dev/null');
      expect(result).toHaveLength(1);
      expect(result[0].localPort).toBe(22);
    });

    test('should fallback to netstat for connections when ss fails', async () => {
      const netstatOutput = `tcp        0      0 192.168.1.100:22        192.168.1.200:12345     ESTABLISHED`;

      mockExecPromise
        .mockRejectedValueOnce(new Error('ss failed'))
        .mockResolvedValueOnce({ stdout: netstatOutput });

      const result = await portMonitor.getActiveConnections();

      expect(mockExecPromise).toHaveBeenCalledWith('ss -tan state established 2>/dev/null');
      expect(mockExecPromise).toHaveBeenCalledWith('netstat -tan 2>/dev/null | grep ESTABLISHED');
      expect(result).toHaveLength(1);
    });
  });

  describe('error handling', () => {
    test('should handle empty command output', async () => {
      mockExecPromise.mockResolvedValueOnce({ stdout: '' });

      const result = await portMonitor.getActivePorts();

      expect(result).toEqual([]);
    });

    test('should handle command timeout gracefully', async () => {
      const cachedPorts = [{ port: 22, protocol: 'tcp' }];
      portMonitor.cachedPorts = cachedPorts;

      mockExecPromise.mockRejectedValueOnce(new Error('Command timeout'));

      const result = await portMonitor.getActivePorts();

      expect(result).toEqual(cachedPorts);
    });
  });

  describe('performance', () => {
    test('should respect cache timeout', async () => {
      const fastPortMonitor = new PortMonitor({ cacheTimeout: 100 }); // 100ms cache
      const output = `tcp   LISTEN 0      128          0.0.0.0:22             0.0.0.0:*    users:(("sshd",pid=1234,fd=3))`;

      mockExecPromise.mockResolvedValue({ stdout: output });

      // First call should execute command
      await fastPortMonitor.getActivePorts();
      expect(mockExecPromise).toHaveBeenCalledTimes(1);

      // Second call immediately should use cache
      await fastPortMonitor.getActivePorts();
      expect(mockExecPromise).toHaveBeenCalledTimes(1);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Third call should execute command again
      await fastPortMonitor.getActivePorts();
      expect(mockExecPromise).toHaveBeenCalledTimes(2);
    });
  });
});