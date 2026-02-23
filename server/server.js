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

require('dotenv').config();

const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');

const GameManager = require('./gameManager');
const { getAllFields } = require('./fieldConfigs');
const { connectDB, isDBConnected } = require('./db');
const playerService = require('./services/playerService');
const matchService = require('./services/matchService');
const leaderboardService = require('./services/leaderboardService');
const tournamentService = require('./services/tournamentService');

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

const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;

// Serve client files
app.use(express.static(path.join(__dirname, '..', 'client'), {
    etag: true,
    maxAge: isProduction ? '1d' : 0,
    setHeaders: (res) => {
        if (!isProduction) {
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
            res.set('Pragma', 'no-cache');
        }
    }
}));

// API: Get all field configs (for field selection)
app.get('/api/fields', (req, res) => {
    res.json(getAllFields());
});

// API: Leaderboard
app.get('/api/leaderboard', async (req, res) => {
    try {
        const type = req.query.type || 'weekly';
        const data = await leaderboardService.getLeaderboard(type);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Skor tablosu yüklenemedi' });
    }
});

// API: Player profile
app.get('/api/player/:username', async (req, res) => {
    try {
        const player = await playerService.getPlayer(req.params.username);
        if (!player) return res.status(404).json({ error: 'Oyuncu bulunamadı' });
        res.json(player);
    } catch (err) {
        res.status(500).json({ error: 'Profil yüklenemedi' });
    }
});

// API: Player match history
app.get('/api/player/:username/matches', async (req, res) => {
    try {
        const matches = await playerService.getRecentMatches(req.params.username, 20);
        res.json(matches);
    } catch (err) {
        res.status(500).json({ error: 'Maç geçmişi yüklenemedi' });
    }
});

// API: Tournament list
app.get('/api/tournaments', async (req, res) => {
    try {
        const Tournament = require('./models/Tournament');
        const tournaments = await Tournament.find({
            status: { $in: ['waiting', 'in_progress', 'completed'] }
        }).sort({ createdAt: -1 }).limit(20).lean();
        res.json(tournaments);
    } catch (err) {
        res.json([]);
    }
});

// API: Tournament detail
app.get('/api/tournament/:id', async (req, res) => {
    try {
        const Tournament = require('./models/Tournament');
        const tournament = await Tournament.findById(req.params.id).lean();
        if (!tournament) return res.status(404).json({ error: 'Turnuva bulunamadı' });
        res.json(tournament);
    } catch (err) {
        res.status(500).json({ error: 'Turnuva yüklenemedi' });
    }
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
        // ── Auth ──
        case 'AUTH_REGISTER': {
            (async () => {
                try {
                    const result = await playerService.registerPlayer(message.username);
                    if (!result) {
                        ws.send(JSON.stringify({ type: 'AUTH_ERROR', message: 'Bu kullanıcı adı zaten alınmış' }));
                        return;
                    }
                    ws.playerUsername = result.player.username;
                    ws.send(JSON.stringify({
                        type: 'AUTH_SUCCESS',
                        player: { username: result.player.username, rating: result.player.rating, stats: result.player.stats },
                        token: result.token
                    }));
                    console.log(`[AUTH] Yeni kayıt: ${message.username}`);
                } catch (err) {
                    console.error('[AUTH] Kayıt hatası:', err.message);
                    ws.send(JSON.stringify({ type: 'AUTH_ERROR', message: 'Kayıt sırasında hata oluştu' }));
                }
            })();
            break;
        }

        case 'AUTH_LOGIN': {
            (async () => {
                try {
                    const player = await playerService.loginByToken(message.token);
                    if (!player) {
                        ws.send(JSON.stringify({ type: 'AUTH_ERROR', message: 'Geçersiz oturum. Lütfen yeniden kayıt olun.' }));
                        return;
                    }
                    ws.playerUsername = player.username;
                    ws.send(JSON.stringify({
                        type: 'AUTH_SUCCESS',
                        player: { username: player.username, rating: player.rating, stats: player.stats },
                        token: message.token
                    }));
                    console.log(`[AUTH] Giriş: ${player.username}`);
                } catch (err) {
                    console.error('[AUTH] Giriş hatası:', err.message);
                    ws.send(JSON.stringify({ type: 'AUTH_ERROR', message: 'Giriş sırasında hata oluştu' }));
                }
            })();
            break;
        }

        // ── Game ──
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

        // ── Match Recording ──
        case 'MATCH_RESULT': {
            (async () => {
                try {
                    if (!isDBConnected()) return;
                    const result = await matchService.recordMatch(message.data);
                    if (result && result.eloChanges) {
                        ws.send(JSON.stringify({ type: 'ELO_UPDATE', eloChanges: result.eloChanges }));
                    }
                } catch (err) {
                    console.error('[MATCH] Maç kayıt hatası:', err.message);
                }
            })();
            break;
        }

        // ── Tournament ──
        case 'TOURNAMENT_CREATE': {
            (async () => {
                try {
                    const tournament = await tournamentService.createTournament({
                        name: message.name,
                        createdBy: ws.playerUsername,
                        maxPlayers: message.maxPlayers,
                        goalLimit: message.goalLimit
                    });
                    if (tournament) {
                        ws.send(JSON.stringify({ type: 'TOURNAMENT_CREATED', tournament }));
                        broadcastAll({ type: 'TOURNAMENT_UPDATED', tournament });
                    }
                } catch (err) {
                    ws.send(JSON.stringify({ type: 'TOURNAMENT_ERROR', message: 'Turnuva oluşturulamadı' }));
                }
            })();
            break;
        }

        case 'TOURNAMENT_JOIN': {
            (async () => {
                try {
                    const result = await tournamentService.joinTournament(message.tournamentId, ws.playerUsername);
                    if (result.error) {
                        ws.send(JSON.stringify({ type: 'TOURNAMENT_ERROR', message: result.error }));
                    } else {
                        broadcastAll({ type: 'TOURNAMENT_UPDATED', tournament: result.tournament });
                    }
                } catch (err) {
                    ws.send(JSON.stringify({ type: 'TOURNAMENT_ERROR', message: 'Katılma hatası' }));
                }
            })();
            break;
        }

        case 'TOURNAMENT_LEAVE': {
            (async () => {
                try {
                    const result = await tournamentService.leaveTournament(message.tournamentId, ws.playerUsername);
                    if (result.error) {
                        ws.send(JSON.stringify({ type: 'TOURNAMENT_ERROR', message: result.error }));
                    } else {
                        broadcastAll({ type: 'TOURNAMENT_UPDATED', tournament: result.tournament });
                    }
                } catch (err) {
                    ws.send(JSON.stringify({ type: 'TOURNAMENT_ERROR', message: 'Ayrılma hatası' }));
                }
            })();
            break;
        }

        case 'TOURNAMENT_START': {
            (async () => {
                try {
                    const result = await tournamentService.startTournament(message.tournamentId, ws.playerUsername);
                    if (result.error) {
                        ws.send(JSON.stringify({ type: 'TOURNAMENT_ERROR', message: result.error }));
                    } else {
                        broadcastAll({ type: 'TOURNAMENT_STARTED', tournament: result.tournament });
                    }
                } catch (err) {
                    ws.send(JSON.stringify({ type: 'TOURNAMENT_ERROR', message: 'Başlatma hatası' }));
                }
            })();
            break;
        }

        case 'TOURNAMENT_LIST': {
            (async () => {
                try {
                    const list = await tournamentService.listTournaments();
                    ws.send(JSON.stringify({ type: 'TOURNAMENT_LIST', tournaments: list }));
                } catch (err) {
                    ws.send(JSON.stringify({ type: 'TOURNAMENT_LIST', tournaments: [] }));
                }
            })();
            break;
        }

        default:
            console.log(`[DEBUG] Bilinmeyen mesaj tipi: ${type}`);
    }
}

// ═══════════════════════════════════════════════════
// Broadcast Yardımcıları
// ═══════════════════════════════════════════════════

/**
 * Tüm bağlı istemcilere mesaj gönder
 */
function broadcastAll(data) {
    const msg = JSON.stringify(data);
    wss.clients.forEach(client => {
        if (client.readyState === 1) { // OPEN
            client.send(msg);
        }
    });
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
    server.listen(port, '0.0.0.0', () => {
        console.log(`[INFO] Oyun sunucusu baslatildi (Port: ${port})`);

        // Stats emisyonu (Manager.js için)
        setInterval(() => {
            const stats = gameManager.getStats();
            console.log(`[STATS] ${JSON.stringify(stats)}`);
        }, 2000);

        // Boş odaları temizleme
        setInterval(() => {
            gameManager.clearEmptyRooms();
        }, 60000);

    }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`[INFO] Port ${port} kullanimda, ${port + 1} portu deneniyor...`);
            server.removeAllListeners('error');
            startServer(port + 1);
        } else {
            console.error('[ERROR] Sunucu baslatilamadi:', err);
        }
    });
}

// Connect to MongoDB then start server
connectDB().then(() => {
    startServer(currentPort);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n[INFO] Sunucu kapatiliyor...');
    wss.close();
    server.close(() => {
        console.log('[INFO] Sunucu kapatildi.');
        process.exit(0);
    });
    // Force close after 1.5 seconds if keep-alive connections are active
    setTimeout(() => {
        console.log('[INFO] Sunucu kapatildi (Zorla).');
        process.exit(0);
    }, 1500);
});
