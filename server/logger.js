/**
 * logger.js - Dosya ve Konsol Log Sistemi
 * 
 * Logları hem konsola hem de dosyaya yazar.
 * Log dosyaları: nail-football/logs/YYYY-MM-DD.log
 * 7 günden eski loglar otomatik temizlenir.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const MAX_LOG_AGE_DAYS = 7;

/** Ensure log directory exists */
function ensureLogDir() {
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }
}

/** Get today's log file path */
function getLogFilePath() {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(LOG_DIR, `${dateStr}.log`);
}

/** Format a log entry */
function formatEntry(level, message) {
    const now = new Date();
    const time = now.toTimeString().split(' ')[0]; // HH:MM:SS
    return `[${time}] [${level.toUpperCase()}] ${message}`;
}

/**
 * Writes a log entry to console and file
 * @param {string} level - Log level (info, error, warn, debug)
 * @param {string} message - Log message
 */
function log(level, message) {
    if (!message || !message.trim()) return;

    const entry = formatEntry(level, message.trim());

    // Console output
    if (level === 'error') {
        console.error(entry);
    } else {
        console.log(entry);
    }

    // File output
    try {
        ensureLogDir();
        fs.appendFileSync(getLogFilePath(), entry + '\n');
    } catch (e) {
        // Silently fail file writes
    }
}

/** Clean up old log files (older than MAX_LOG_AGE_DAYS) */
function cleanOldLogs() {
    try {
        ensureLogDir();
        const files = fs.readdirSync(LOG_DIR);
        const cutoff = Date.now() - MAX_LOG_AGE_DAYS * 24 * 60 * 60 * 1000;

        for (const file of files) {
            if (!file.endsWith('.log')) continue;
            const filePath = path.join(LOG_DIR, file);
            const stat = fs.statSync(filePath);
            if (stat.mtimeMs < cutoff) {
                fs.unlinkSync(filePath);
            }
        }
    } catch (e) {
        // Silently fail cleanup
    }
}

/** @returns {string} Path to the logs directory */
function getLogDir() {
    return LOG_DIR;
}

// Run cleanup on load
cleanOldLogs();

module.exports = { log, getLogDir, cleanOldLogs };
