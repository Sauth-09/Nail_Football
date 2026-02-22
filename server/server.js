/**
 * server.js - Ana Sunucu (Express + WebSocket)
 * 
 * Çivi Futbolu oyununun ana sunucu dosyası.
 * Express ile statik dosya servisi ve WebSocket ile
 * gerçek zamanlı multiplayer iletişimi sağlar.
 * 
 * Başlatma: node server/server.js
 * Varsayılan port: 3000
 */

'use strict';

const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');

const GameManager = require('./gameManager');
const { getAllFields } = require('./fieldConfigs');

// ═══════════════════════════════════════════════════
// Sunucu Yapılandırması
// ═══════════════════════════════════════════════════

/** @type {number} Starting port */
let currentPort = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const gameManager = new GameManager();

// ═══════════════════════════════════════════════════
// Statik Dosya Servisi
// ═══════════════════════════════════════════════════

// Serve client files
app.use(express.static(path.join(__dirname, '..', 'client')));

// API: Get all field configs (for field selection)
app.get('/api/fields', (req, res) => {
    res.json(getAllFields());
});

// ═══════════════════════════════════════════════════
// WebSocket Bağlantı Yönetimi
// ═══════════════════════════════════════════════════

wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log(`[INFO] Yeni bağlantı: ${clientIp}`);

    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (data) => {
        let message;
        try {
            message = JSON.parse(data.toString());
        } catch (error) {
            console.error('[ERROR] JSON parse hatası:', error.message);
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Geçersiz mesaj formatı' }));
            return;
        }

        handleMessage(ws, message);
    });

    ws.on('close', () => {
        console.log(`[INFO] Bağlantı kapandı: ${clientIp}`);
        gameManager.handleDisconnect(ws);
    });

    ws.on('error', (error) => {
        console.error(`[ERROR] WebSocket hatası: ${error.message}`);
    });
});

/**
 * Handles incoming WebSocket messages
 * @param {WebSocket} ws - Client WebSocket
 * @param {Object} message - Parsed message object
 */
function handleMessage(ws, message) {
    const { type } = message;

    switch (type) {
        case 'CREATE_ROOM': {
            const result = gameManager.createRoom(ws, message.playerName);
            ws.send(JSON.stringify(result));
            break;
        }

        case 'JOIN_ROOM': {
            const result = gameManager.joinRoom(ws, message.roomCode, message.playerName);
            ws.send(JSON.stringify(result));
            break;
        }

        case 'SELECT_FIELD': {
            const roomCode = gameManager.findRoomByWs(ws);
            if (!roomCode) {
                ws.send(JSON.stringify({ type: 'ERROR', message: 'Odada değilsiniz!' }));
                return;
            }
            const playerId = gameManager.getPlayerId(roomCode, ws);
            if (playerId !== 1) {
                ws.send(JSON.stringify({ type: 'ERROR', message: 'Sadece oda sahibi saha seçebilir!' }));
                return;
            }
            gameManager.selectField(roomCode, message.fieldId);
            break;
        }

        case 'CONFIRM_FIELD': {
            const roomCode = gameManager.findRoomByWs(ws);
            if (!roomCode) return;
            gameManager.confirmField(roomCode);
            break;
        }

        case 'SHOOT': {
            const roomCode = gameManager.findRoomByWs(ws);
            if (!roomCode) return;
            const playerId = gameManager.getPlayerId(roomCode, ws);
            if (playerId === null) return;
            gameManager.processShot(roomCode, playerId, message.angle, message.power);
            break;
        }

        case 'READY': {
            const roomCode = gameManager.findRoomByWs(ws);
            if (roomCode) {
                console.log(`[INFO] Oyuncu hazır: Oda ${roomCode}`);
            }
            break;
        }

        default:
            console.log(`[DEBUG] Bilinmeyen mesaj tipi: ${type}`);
    }
}

// ═══════════════════════════════════════════════════
// Heartbeat (Bağlantı Kontrolü)
// ═══════════════════════════════════════════════════

const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (!ws.isAlive) {
            console.log('[INFO] Yanıt vermeyen bağlantı kapatılıyor');
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

wss.on('close', () => {
    clearInterval(heartbeatInterval);
});

// ═══════════════════════════════════════════════════
// IP Adresi Algılama
// ═══════════════════════════════════════════════════

/**
 * Gets the local network IP address
 * @returns {string} IP address
 */
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

// ═══════════════════════════════════════════════════
// Sunucu Başlatma
// ═══════════════════════════════════════════════════

function startServer(port) {
    server.listen(port, () => {
        const localIP = getLocalIP();
        const localUrl = `http://localhost:${port}`;
        const networkUrl = `http://${localIP}:${port}`;

        console.log('');
        console.log('╔═══════════════════════════════════════════╗');
        console.log('║     ⚽ ÇİVİ FUTBOLU SUNUCUSU BAŞLADI     ║');
        console.log('║                                           ║');
        console.log(`║   Yerel:  ${localUrl}`.padEnd(44, ' ') + '║');
        console.log(`║   Ağ:     ${networkUrl}`.padEnd(44, ' ') + '║');
        console.log('║                                           ║');
        console.log('║   Bağlantı bekliyor...                    ║');
        console.log('╚═══════════════════════════════════════════╝');
        console.log('');

        // Tarayıcıyı otomatik aç
        const startCommand = process.platform === 'win32' ? 'start' : (process.platform === 'darwin' ? 'open' : 'xdg-open');
        exec(`${startCommand} ${localUrl}`, (err) => {
            if (err) console.error('[HATA] Tarayıcı otomatik açılamadı:', err.message);
        });
    }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`[BİLGİ] Port ${port} kullanımda, ${port + 1} portu deneniyor...`);
            // Error dinleyicisini kaldır ki tekrar başlatırken sorun olmasın
            server.removeAllListeners('error');
            startServer(port + 1);
        } else {
            console.error('[HATA] Sunucu başlatılamadı:', err);
        }
    });
}

startServer(currentPort);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n[INFO] Sunucu kapatılıyor...');
    wss.close();
    server.close(() => {
        console.log('[INFO] Sunucu kapatıldı.');
        process.exit(0);
    });
});
