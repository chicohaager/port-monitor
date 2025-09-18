const fs = require('fs').promises;
const path = require('path');

class Logger {
    constructor() {
        this.logPath = path.join(__dirname, '../../data/app.log');
        this.errorLogPath = path.join(__dirname, '../../data/error.log');
        this.levels = {
            ERROR: 0,
            WARN: 1,
            INFO: 2,
            DEBUG: 3
        };
        this.currentLevel = process.env.LOG_LEVEL ?
            this.levels[process.env.LOG_LEVEL.toUpperCase()] : this.levels.INFO;
    }

    async writeLog(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            data,
            pid: process.pid
        };

        const logLine = JSON.stringify(logEntry) + '\n';

        try {
            const logPath = level === 'ERROR' ? this.errorLogPath : this.logPath;
            await fs.appendFile(logPath, logLine);
        } catch (err) {
            console.error('Failed to write log:', err);
        }

        // Also log to console in development
        if (process.env.NODE_ENV !== 'production') {
            const color = {
                ERROR: '\x1b[31m',
                WARN: '\x1b[33m',
                INFO: '\x1b[36m',
                DEBUG: '\x1b[37m'
            }[level] || '\x1b[37m';

            console.log(`${color}[${timestamp}] [${level}] ${message}\x1b[0m`, data || '');
        }
    }

    error(message, error = null) {
        if (this.currentLevel >= this.levels.ERROR) {
            const errorData = error ? {
                message: error.message,
                stack: error.stack,
                code: error.code
            } : null;
            this.writeLog('ERROR', message, errorData);
        }
    }

    warn(message, data = null) {
        if (this.currentLevel >= this.levels.WARN) {
            this.writeLog('WARN', message, data);
        }
    }

    info(message, data = null) {
        if (this.currentLevel >= this.levels.INFO) {
            this.writeLog('INFO', message, data);
        }
    }

    debug(message, data = null) {
        if (this.currentLevel >= this.levels.DEBUG) {
            this.writeLog('DEBUG', message, data);
        }
    }

    async rotateLogs() {
        const maxSize = 10 * 1024 * 1024; // 10MB
        const maxFiles = 5;

        try {
            for (const logPath of [this.logPath, this.errorLogPath]) {
                const stats = await fs.stat(logPath).catch(() => null);

                if (stats && stats.size > maxSize) {
                    // Rotate log files
                    for (let i = maxFiles - 1; i >= 0; i--) {
                        const oldPath = i === 0 ? logPath : `${logPath}.${i}`;
                        const newPath = `${logPath}.${i + 1}`;

                        try {
                            await fs.rename(oldPath, newPath);
                        } catch (err) {
                            // File might not exist
                        }
                    }

                    // Create new empty log file
                    await fs.writeFile(logPath, '');
                }
            }
        } catch (err) {
            console.error('Failed to rotate logs:', err);
        }
    }
}

module.exports = new Logger();