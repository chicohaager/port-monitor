// Mock fs operations first
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn()
  }
}));

const SecurityAnalyzer = require('../../server/services/securityAnalyzer');
const fs = require('fs').promises;

// Mock the port database
jest.mock('../../server/data/portDatabase', () => ({
  getPortInfo: jest.fn(),
  generateSecurityAlert: jest.fn()
}));

describe('SecurityAnalyzer', () => {
  let securityAnalyzer;
  const mockPortInfo = require('../../server/data/portDatabase');

  beforeEach(() => {
    securityAnalyzer = new SecurityAnalyzer();
    jest.clearAllMocks();

    // Default mock implementations
    fs.readFile.mockRejectedValue(new Error('File not found'));
    fs.writeFile.mockResolvedValue();
    fs.mkdir.mockResolvedValue();

    mockPortInfo.getPortInfo.mockReturnValue({
      service: 'Unknown',
      description: 'Unknown service',
      risk: 'medium',
      isDangerous: false,
      isDevelopment: false,
      isDatabase: false,
      processMatch: false
    });

    mockPortInfo.generateSecurityAlert.mockReturnValue({
      type: 'unknown_process',
      severity: 'medium',
      message: 'Test alert',
      port: 12345,
      process: 'test-process',
      timestamp: new Date().toISOString(),
      recommendations: ['Test recommendation']
    });
  });

  describe('constructor', () => {
    test('should initialize with default properties', () => {
      expect(securityAnalyzer.whitelistPath).toBeDefined();
      expect(securityAnalyzer.suspiciousPatterns).toBeDefined();
      expect(securityAnalyzer.portScanThreshold).toBe(10);
      expect(securityAnalyzer.connectionHistory).toBeInstanceOf(Map);
    });

    test('should have suspicious patterns configured', () => {
      expect(securityAnalyzer.suspiciousPatterns.length).toBeGreaterThan(0);
      expect(securityAnalyzer.suspiciousPatterns[0]).toHaveProperty('pattern');
      expect(securityAnalyzer.suspiciousPatterns[0]).toHaveProperty('severity');
      expect(securityAnalyzer.suspiciousPatterns[0]).toHaveProperty('reason');
    });
  });

  describe('loadWhitelist', () => {
    test('should load existing whitelist from file', async () => {
      const mockWhitelist = { ports: [22, 80], processes: ['sshd', 'nginx'] };
      fs.readFile.mockResolvedValue(JSON.stringify(mockWhitelist));

      const result = await securityAnalyzer.loadWhitelist();

      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('whitelist.json'),
        'utf-8'
      );
      expect(result).toEqual(mockWhitelist);
    });

    test('should return default whitelist when file does not exist', async () => {
      fs.readFile.mockRejectedValue(new Error('File not found'));

      const result = await securityAnalyzer.loadWhitelist();

      expect(result).toEqual({ ports: [], processes: [] });
    });

    test('should handle malformed JSON gracefully', async () => {
      fs.readFile.mockResolvedValue('invalid json');

      const result = await securityAnalyzer.loadWhitelist();

      expect(result).toEqual({ ports: [], processes: [] });
    });
  });

  describe('saveWhitelist', () => {
    test('should save whitelist to file', async () => {
      const whitelist = { ports: [22, 80], processes: ['sshd', 'nginx'] };

      await securityAnalyzer.saveWhitelist(whitelist);

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.any(String),
        { recursive: true }
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('whitelist.json'),
        JSON.stringify(whitelist, null, 2)
      );
    });
  });

  describe('addToWhitelist', () => {
    test('should add new port and process to whitelist', async () => {
      const existingWhitelist = { ports: [22], processes: ['sshd'] };
      fs.readFile.mockResolvedValue(JSON.stringify(existingWhitelist));

      await securityAnalyzer.addToWhitelist(80, 'nginx');

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('whitelist.json'),
        JSON.stringify({ ports: [22, 80], processes: ['sshd', 'nginx'] }, null, 2)
      );
    });

    test('should not duplicate existing entries', async () => {
      const existingWhitelist = { ports: [22], processes: ['sshd'] };
      fs.readFile.mockResolvedValue(JSON.stringify(existingWhitelist));

      await securityAnalyzer.addToWhitelist(22, 'sshd');

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('whitelist.json'),
        JSON.stringify({ ports: [22], processes: ['sshd'] }, null, 2)
      );
    });

    test('should handle adding port without process', async () => {
      const existingWhitelist = { ports: [], processes: [] };
      fs.readFile.mockResolvedValue(JSON.stringify(existingWhitelist));

      await securityAnalyzer.addToWhitelist(80);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('whitelist.json'),
        JSON.stringify({ ports: [80], processes: [] }, null, 2)
      );
    });
  });

  describe('removeFromWhitelist', () => {
    test('should remove port from whitelist', async () => {
      const existingWhitelist = { ports: [22, 80], processes: ['sshd', 'nginx'] };
      fs.readFile.mockResolvedValue(JSON.stringify(existingWhitelist));

      await securityAnalyzer.removeFromWhitelist(80);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('whitelist.json'),
        JSON.stringify({ ports: [22], processes: ['sshd', 'nginx'] }, null, 2)
      );
    });

    test('should handle removing non-existent port', async () => {
      const existingWhitelist = { ports: [22], processes: ['sshd'] };
      fs.readFile.mockResolvedValue(JSON.stringify(existingWhitelist));

      await securityAnalyzer.removeFromWhitelist(999);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('whitelist.json'),
        JSON.stringify({ ports: [22], processes: ['sshd'] }, null, 2)
      );
    });
  });

  describe('analyzePorts', () => {
    test('should analyze ports and return alerts', async () => {
      const ports = [
        { port: 22, process: 'sshd', protocol: 'tcp' },
        { port: 12345, process: 'unknown', protocol: 'tcp' }
      ];

      // Mock whitelist (empty)
      fs.readFile.mockRejectedValue(new Error('File not found'));

      // Mock port info for known port
      mockPortInfo.getPortInfo.mockImplementation((port) => {
        if (port === 22) {
          return {
            service: 'SSH',
            description: 'Secure Shell',
            risk: 'low',
            isDangerous: false,
            processMatch: true
          };
        }
        return {
          service: 'Unknown',
          description: 'Unknown service',
          risk: 'medium',
          isDangerous: false,
          processMatch: false
        };
      });

      // Mock alert generation
      mockPortInfo.generateSecurityAlert.mockImplementation((portInfo, portData) => ({
        type: 'unknown_process',
        severity: 'medium',
        message: `Unknown process on port ${portData.port}`,
        port: portData.port,
        process: portData.process,
        timestamp: new Date().toISOString(),
        recommendations: ['Investigate process']
      }));

      const result = await securityAnalyzer.analyzePorts(ports);

      expect(Array.isArray(result)).toBe(true);
      expect(mockPortInfo.getPortInfo).toHaveBeenCalledTimes(2);
    });

    test('should handle whitelisted ports correctly', async () => {
      const ports = [
        { port: 22, process: 'sshd', protocol: 'tcp' }
      ];

      // Mock whitelist with port 22
      const whitelist = { ports: [22], processes: ['sshd'] };
      fs.readFile.mockResolvedValue(JSON.stringify(whitelist));

      const result = await securityAnalyzer.analyzePorts(ports);

      expect(Array.isArray(result)).toBe(true);
      // Should still analyze but might have different behavior for whitelisted ports
    });

    test('should handle empty ports array', async () => {
      const result = await securityAnalyzer.analyzePorts([]);

      expect(result).toEqual([]);
    });

    test('should handle analysis errors gracefully', async () => {
      const ports = [
        { port: 22, process: 'sshd', protocol: 'tcp' }
      ];

      // Mock file system error
      fs.readFile.mockRejectedValue(new Error('Permission denied'));

      // Should not throw but handle gracefully
      await expect(securityAnalyzer.analyzePorts(ports)).resolves.toBeDefined();
    });
  });

  describe('suspicious patterns detection', () => {
    test('should detect netcat process as suspicious', () => {
      const pattern = securityAnalyzer.suspiciousPatterns.find(p => p.pattern.test('nc'));
      expect(pattern).toBeDefined();
      expect(pattern.severity).toBe('high');
      expect(pattern.reason).toContain('backdoor');
    });

    test('should detect crypto miner as critical', () => {
      const pattern = securityAnalyzer.suspiciousPatterns.find(p => p.pattern.test('xmrig'));
      expect(pattern).toBeDefined();
      expect(pattern.severity).toBe('critical');
      expect(pattern.reason).toContain('miner');
    });

    test('should detect telnet as medium risk', () => {
      const pattern = securityAnalyzer.suspiciousPatterns.find(p => p.pattern.test('telnet'));
      expect(pattern).toBeDefined();
      expect(pattern.severity).toBe('medium');
      expect(pattern.reason).toContain('Insecure protocol');
    });
  });

  describe('connection history tracking', () => {
    test('should initialize with empty connection history', () => {
      expect(securityAnalyzer.connectionHistory).toBeInstanceOf(Map);
      expect(securityAnalyzer.connectionHistory.size).toBe(0);
    });

    test('should have configurable port scan threshold', () => {
      expect(securityAnalyzer.portScanThreshold).toBe(10);
    });
  });

  describe('error handling', () => {
    test('should handle file system errors in loadWhitelist', async () => {
      fs.readFile.mockRejectedValue(new Error('Disk full'));

      const result = await securityAnalyzer.loadWhitelist();

      expect(result).toEqual({ ports: [], processes: [] });
    });

    test('should handle file system errors in saveWhitelist', async () => {
      fs.writeFile.mockRejectedValue(new Error('Permission denied'));

      await expect(
        securityAnalyzer.saveWhitelist({ ports: [], processes: [] })
      ).rejects.toThrow('Permission denied');
    });
  });
});