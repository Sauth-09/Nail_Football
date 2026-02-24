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
const fs = require('fs');
const { exec } = require('child_process');

const GameManager = require('./gameManager');
const { getAllFields } = require('./fieldConfigs');
const { connectDB, isDBConnected } = require('./db');
const playerService = require('./services/playerService');
const matchService = require('./services/matchService');
const leaderboardService = require('./services/leaderboardService');
const tournamentService = require('./services/tournamentService');
const onlineTracker = require('./services/onlineTracker');
const friendService = require('./services/friendService');
const ChallengeManager = require('./services/challengeManager');
const Player = require('./models/Player');
const bcrypt = require('bcryptjs');

// ═══════════════════════════════════════════════════
// Sunucu Yapılandırması
// ═══════════════════════════════════════════════════

/** @type {number} Starting port */
let currentPort = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const gameManager = new GameManager();
const challengeManager = new ChallengeManager(onlineTracker);

// ═══════════════════════════════════════════════════
// Statik Dosya Servisi
// ═══════════════════════════════════════════════════

const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;

// Otomatik Cache-Busting: index.html isteklerini yakalayıp versiyonları güncelleyelim
app.get(['/', '/index.html'], (req, res) => {
    const indexPath = path.join(__dirname, '..', 'client', 'index.html');
    fs.readFile(indexPath, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).send('Error loading index.html');
        }

        // CSS ve JS dosyalarındaki ?v= versiyon takılarını o anki zaman damgasıyla değiştir
        const timestamp = Date.now();
        const html = data.replace(/\?v=\d+/g, `?v=${timestamp}`);

        // index.html'in kendisinin önbelleğe alınmasını kesinlikle engelle
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        res.set('Surrogate-Control', 'no-store');

        res.send(html);
    });
});

// Basic Auth Middleware for Admin Panel
const adminAuth = (req, res, next) => {
    // Disable auth in development if no env vars are set, or strictly enforce it
    const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '123456';

    // Parse the 'Authorization' header
    const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
    const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');

    // Verify
    if (login && password && login === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        return next();
    }

    // Access Denied
    res.set('WWW-Authenticate', 'Basic realm="401"');
    res.status(401).send('Yetkisiz Erişim! Lütfen admin bilgilerinizi girin.');
};

// Admin Paneli (Render vb. platformlarda ayni port uzerinden calismasi icin)
app.use('/admin', adminAuth, express.static(path.join(__dirname, 'managerUI')));

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
// Çevrimiçi Durum Broadcast
// ═══════════════════════════════════════════════════

/**
 * Oyuncunun durumu değiştiğinde arkadaşlarına bildir
 */
async function broadcastStatusToFriends(username, status) {
    try {
        const player = await Player.findOne({ username }).select('friends');
        if (!player) return;

        for (const friend of player.friends) {
            onlineTracker.sendTo(friend.username, {
                type: 'FRIEND_STATUS_CHANGED',
                username: username,
                status: status
            });
        }
    } catch (err) {
        console.error('[STATUS] Durum broadcast hatası:', err.message);
    }
}

// ═══════════════════════════════════════════════════
// WebSocket Bağlantı Yönetimi
// ═══════════════════════════════════════════════════

wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;

    // Check if this is an admin panel connection
    if (req.url === '/manager-ws') {
        const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
        const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '123456';

        // WS authentication check (Basic Auth headers sent by the browser)
        const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
        const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');

        if (!login || !password || login !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
            console.log(`[WARN] Yetkisiz Admin WebSocket bağlantı denemesi: ${clientIp}`);
            ws.send(JSON.stringify({ type: 'log', level: 'error', text: 'Yetkisiz Erişim.' }));
            return ws.close(1008, 'Unauthorized'); // Policy Violation
        }

        ws.isAdmin = true;
        console.log(`[INFO] Admin Paneli bağlandı: ${clientIp}`);

        // Initial state
        ws.send(JSON.stringify({
            type: 'state',
            data: {
                isRunning: true,
                port: currentPort,
                players: onlineTracker.getOnlineCount(),
                rooms: gameManager.rooms.size,
                autostart: false,
                firewallStatus: 'ok' // Render is always internet accessible
            }
        }));

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                if (data.type === 'ping') return;

                if (data.type === 'cmd') {
                    // Admin commands processor
                    handleAdminCommand(data, ws);
                }
            } catch (e) { }
        });
        return; // Don't process normal game logic
    }

    // Normal Game Connection
    console.log(`[INFO] Yeni oyun bağlantısı: ${clientIp}`);

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

    ws.on('close', async () => {
        console.log(`[INFO] Bağlantı kapandı: ${clientIp}`);

        // Online tracker'dan çıkar ve arkadaşlara bildir
        const username = onlineTracker.handleDisconnect(ws);
        if (username) {
            await broadcastStatusToFriends(username, 'offline');
            // ChallengeManager'dan temizlik
            challengeManager.handleDisconnect(username);
            // DB'de lastActive güncelle
            try {
                await Player.updateOne({ username }, { lastActive: new Date() });
            } catch (err) { /* silent */ }
        }

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
                if (!message.password || message.password.length < 4) {
                    ws.send(JSON.stringify({ type: 'AUTH_ERROR', message: 'Şifre en az 4 karakter olmalıdır.' }));
                    return;
                }
                try {
                    const result = await playerService.registerPlayer(message.username, message.password);
                    ws.playerUsername = result.player.username;

                    // Online tracker'a ekle
                    onlineTracker.setOnline(result.player.username, ws);

                    ws.send(JSON.stringify({
                        type: 'AUTH_SUCCESS',
                        player: {
                            username: result.player.username,
                            rating: result.player.rating,
                            stats: result.player.stats,
                            memberCode: result.player.memberCode,
                            createdAt: result.player.createdAt
                        },
                        token: result.token
                    }));
                    console.log(`[AUTH] Yeni kayıt: ${message.username} #${result.player.memberCode}`);

                    // Arkadaşlara çevrimiçi bildir
                    await broadcastStatusToFriends(result.player.username, 'online');
                } catch (err) {
                    if (err.message === 'NO_DB_CONNECTION') {
                        ws.send(JSON.stringify({ type: 'AUTH_ERROR', message: 'Sunucuya bağlanılamıyor (Veritabanı kapalı).' }));
                    } else if (err.message === 'USERNAME_TAKEN') {
                        ws.send(JSON.stringify({ type: 'AUTH_ERROR', message: 'Bu kullanıcı adı zaten alınmış.' }));
                    } else {
                        console.error('[AUTH] Kayıt hatası:', err.message);
                        ws.send(JSON.stringify({ type: 'AUTH_ERROR', message: 'Kayıt sırasında bilinmeyen bir hata oluştu.' }));
                    }
                }
            })();
            break;
        }

        case 'AUTH_LOGIN_PASSWORD': {
            (async () => {
                if (!message.username || !message.password) {
                    ws.send(JSON.stringify({ type: 'AUTH_ERROR', message: 'Kullanıcı adı ve şifre gereklidir.' }));
                    return;
                }
                try {
                    const result = await playerService.loginByPassword(message.username, message.password);
                    if (!result) {
                        ws.send(JSON.stringify({ type: 'AUTH_ERROR', message: 'Kullanıcı adı veya şifre hatalı.' }));
                        return;
                    }
                    ws.playerUsername = result.player.username;

                    // Online tracker'a ekle
                    onlineTracker.setOnline(result.player.username, ws);

                    ws.send(JSON.stringify({
                        type: 'AUTH_SUCCESS',
                        player: {
                            username: result.player.username,
                            rating: result.player.rating,
                            stats: result.player.stats,
                            memberCode: result.player.memberCode,
                            createdAt: result.player.createdAt
                        },
                        token: result.token
                    }));
                    console.log(`[AUTH] Şifre ile giriş: ${result.player.username}`);

                    // Arkadaşlara çevrimiçi bildir
                    await broadcastStatusToFriends(result.player.username, 'online');
                } catch (err) {
                    console.error('[AUTH] Giriş hatası:', err.message);
                    ws.send(JSON.stringify({ type: 'AUTH_ERROR', message: 'Giriş sırasında hata oluştu.' }));
                }
            })();
            break;
        }

        case 'AUTH_LOGIN': {
            (async () => {
                try {
                    const player = await playerService.loginByToken(message.token);
                    if (!player) {
                        ws.send(JSON.stringify({ type: 'AUTH_ERROR', message: 'Geçersiz veya süresi dolmuş oturum. Tekrar kayıt olun.' }));
                        return;
                    }
                    ws.playerUsername = player.username;

                    // Online tracker'a ekle
                    onlineTracker.setOnline(player.username, ws);

                    ws.send(JSON.stringify({
                        type: 'AUTH_SUCCESS',
                        player: {
                            username: player.username,
                            rating: player.rating,
                            stats: player.stats,
                            memberCode: player.memberCode,
                            createdAt: player.createdAt
                        },
                        token: message.token
                    }));
                    console.log(`[AUTH] Giriş: ${player.username} #${player.memberCode}`);

                    // Arkadaşlara çevrimiçi bildir
                    await broadcastStatusToFriends(player.username, 'online');
                } catch (err) {
                    console.error('[AUTH] Giriş hatası:', err.message);
                    ws.send(JSON.stringify({ type: 'AUTH_ERROR', message: 'Sunucuyla bağlantı kurulamadı.' }));
                }
            })();
            break;
        }

        // ── Friend System ──
        case 'FRIEND_SEARCH': {
            (async () => {
                try {
                    if (!ws.playerUsername) {
                        ws.send(JSON.stringify({ type: 'FRIEND_SEARCH_RESULT', error: 'Giriş yapmalısın' }));
                        return;
                    }
                    const result = await friendService.searchByMemberCode(message.memberCode, ws.playerUsername);
                    ws.send(JSON.stringify({ type: 'FRIEND_SEARCH_RESULT', ...result }));
                } catch (err) {
                    console.error('[FRIEND] Arama hatası:', err.message);
                    ws.send(JSON.stringify({ type: 'FRIEND_SEARCH_RESULT', error: 'Arama yapılamadı' }));
                }
            })();
            break;
        }

        case 'FRIEND_SEND_REQUEST': {
            (async () => {
                try {
                    if (!ws.playerUsername) return;
                    const result = await friendService.sendFriendRequest(ws.playerUsername, message.targetMemberCode);
                    if (result.error) {
                        ws.send(JSON.stringify({ type: 'FRIEND_ERROR', message: result.error }));
                    } else if (result.accepted) {
                        // Otomatik kabul edildi (karşı tarafın isteği vardı)
                        ws.send(JSON.stringify({
                            type: 'FRIEND_REQUEST_ACCEPTED',
                            username: result.friend.username,
                            memberCode: result.friend.memberCode,
                            rating: result.friend.rating
                        }));
                        // Karşı tarafa da bildir
                        onlineTracker.sendTo(result.friend.username, {
                            type: 'FRIEND_REQUEST_ACCEPTED',
                            username: result.acceptedBy.username,
                            memberCode: result.acceptedBy.memberCode,
                            rating: result.acceptedBy.rating
                        });
                    } else {
                        ws.send(JSON.stringify({
                            type: 'FRIEND_REQUEST_SENT',
                            to: result.to,
                            memberCode: result.toMemberCode
                        }));
                        // Karşı tarafa anlık bildirim
                        onlineTracker.sendTo(result.to, {
                            type: 'FRIEND_REQUEST_RECEIVED',
                            from: ws.playerUsername,
                            memberCode: result.fromMemberCode,
                            rating: result.fromRating
                        });
                    }
                } catch (err) {
                    console.error('[FRIEND] İstek gönderme hatası:', err.message);
                    ws.send(JSON.stringify({ type: 'FRIEND_ERROR', message: 'İstek gönderilemedi' }));
                }
            })();
            break;
        }

        case 'FRIEND_ACCEPT_REQUEST': {
            (async () => {
                try {
                    if (!ws.playerUsername) return;
                    const result = await friendService.acceptFriendRequest(ws.playerUsername, message.fromUsername);
                    if (result.error) {
                        ws.send(JSON.stringify({ type: 'FRIEND_ERROR', message: result.error }));
                    } else {
                        ws.send(JSON.stringify({
                            type: 'FRIEND_REQUEST_ACCEPTED',
                            username: result.friend.username,
                            memberCode: result.friend.memberCode,
                            rating: result.friend.rating
                        }));
                        // Gönderene bildir
                        onlineTracker.sendTo(result.friend.username, {
                            type: 'FRIEND_REQUEST_ACCEPTED',
                            username: result.acceptedBy.username,
                            memberCode: result.acceptedBy.memberCode,
                            rating: result.acceptedBy.rating
                        });
                    }
                } catch (err) {
                    console.error('[FRIEND] Kabul hatası:', err.message);
                    ws.send(JSON.stringify({ type: 'FRIEND_ERROR', message: 'İstek kabul edilemedi' }));
                }
            })();
            break;
        }

        case 'FRIEND_DECLINE_REQUEST': {
            (async () => {
                try {
                    if (!ws.playerUsername) return;
                    await friendService.declineFriendRequest(ws.playerUsername, message.fromUsername);
                    ws.send(JSON.stringify({ type: 'FRIEND_REQUEST_DECLINED', fromUsername: message.fromUsername }));
                } catch (err) {
                    console.error('[FRIEND] Red hatası:', err.message);
                }
            })();
            break;
        }

        case 'FRIEND_REMOVE': {
            (async () => {
                try {
                    if (!ws.playerUsername) return;
                    const result = await friendService.removeFriend(ws.playerUsername, message.friendUsername);
                    if (result.error) {
                        ws.send(JSON.stringify({ type: 'FRIEND_ERROR', message: result.error }));
                    } else {
                        ws.send(JSON.stringify({ type: 'FRIEND_REMOVED', username: message.friendUsername }));
                    }
                } catch (err) {
                    console.error('[FRIEND] Silme hatası:', err.message);
                }
            })();
            break;
        }

        case 'FRIEND_BLOCK': {
            (async () => {
                try {
                    if (!ws.playerUsername) return;
                    const result = await friendService.blockPlayer(ws.playerUsername, message.username);
                    if (result.error) {
                        ws.send(JSON.stringify({ type: 'FRIEND_ERROR', message: result.error }));
                    } else {
                        ws.send(JSON.stringify({ type: 'FRIEND_BLOCKED', username: message.username }));
                    }
                } catch (err) {
                    console.error('[FRIEND] Engelleme hatası:', err.message);
                }
            })();
            break;
        }

        case 'FRIEND_UNBLOCK': {
            (async () => {
                try {
                    if (!ws.playerUsername) return;
                    const result = await friendService.unblockPlayer(ws.playerUsername, message.username);
                    if (result.error) {
                        ws.send(JSON.stringify({ type: 'FRIEND_ERROR', message: result.error }));
                    } else {
                        ws.send(JSON.stringify({ type: 'FRIEND_UNBLOCKED', username: message.username }));
                    }
                } catch (err) {
                    console.error('[FRIEND] Engel kaldırma hatası:', err.message);
                }
            })();
            break;
        }

        case 'FRIEND_GET_LIST': {
            (async () => {
                try {
                    if (!ws.playerUsername) return;
                    const friends = await friendService.getFriendsList(ws.playerUsername);
                    const enriched = onlineTracker.getOnlineFriends(friends);

                    // Her arkadaşın rating bilgisini de ekle
                    const friendsWithRating = await Promise.all(enriched.map(async (f) => {
                        const player = await Player.findOne({ username: f.username }).select('rating');
                        return { ...f, rating: player ? player.rating : 0 };
                    }));

                    ws.send(JSON.stringify({ type: 'FRIEND_LIST', friends: friendsWithRating }));
                } catch (err) {
                    console.error('[FRIEND] Liste hatası:', err.message);
                    ws.send(JSON.stringify({ type: 'FRIEND_LIST', friends: [] }));
                }
            })();
            break;
        }

        case 'FRIEND_GET_PENDING': {
            (async () => {
                try {
                    if (!ws.playerUsername) return;
                    const pending = await friendService.getPendingRequests(ws.playerUsername);
                    ws.send(JSON.stringify({ type: 'FRIEND_PENDING_LIST', ...pending }));
                } catch (err) {
                    console.error('[FRIEND] Bekleyen istekler hatası:', err.message);
                    ws.send(JSON.stringify({ type: 'FRIEND_PENDING_LIST', incoming: [], outgoing: [] }));
                }
            })();
            break;
        }

        // ── Game Challenge (Meydan Okuma) ──
        case 'GAME_CHALLENGE': {
            (async () => {
                try {
                    if (!ws.playerUsername) return;
                    const result = await challengeManager.createChallenge(
                        ws.playerUsername,
                        message.targetUsername,
                        message.fieldId,
                        message.goalLimit,
                        Player,
                        message.goalkeeperEnabled,
                        message.goalkeeperSize
                    );
                    if (result.error) {
                        ws.send(JSON.stringify({ type: 'GAME_CHALLENGE_ERROR', message: result.error }));
                    } else {
                        ws.send(JSON.stringify({
                            type: 'GAME_CHALLENGE_SENT',
                            challengeId: result.challengeId,
                            to: result.to,
                            toMemberCode: result.toMemberCode,
                            toRating: result.toRating,
                            fieldId: result.fieldId,
                            goalLimit: result.goalLimit,
                            goalkeeperEnabled: result.goalkeeperEnabled,
                            goalkeeperSize: result.goalkeeperSize,
                            expiresIn: result.expiresIn
                        }));
                    }
                } catch (err) {
                    console.error('[CHALLENGE] Oluşturma hatası:', err.message);
                    ws.send(JSON.stringify({ type: 'GAME_CHALLENGE_ERROR', message: 'Davet gönderilemedi' }));
                }
            })();
            break;
        }

        case 'GAME_ACCEPT_CHALLENGE': {
            (async () => {
                try {
                    if (!ws.playerUsername) return;
                    const result = await challengeManager.acceptChallenge(
                        message.challengeId,
                        ws.playerUsername,
                        Player
                    );
                    if (result.error) {
                        ws.send(JSON.stringify({ type: 'GAME_CHALLENGE_ERROR', message: result.error }));
                    }
                    // Kabul edildiyse challengeManager zaten her iki tarafa bildirim gönderdi
                } catch (err) {
                    console.error('[CHALLENGE] Kabul hatası:', err.message);
                    ws.send(JSON.stringify({ type: 'GAME_CHALLENGE_ERROR', message: 'Kabul edilemedi' }));
                }
            })();
            break;
        }

        case 'GAME_DECLINE_CHALLENGE': {
            if (!ws.playerUsername) break;
            challengeManager.declineChallenge(message.challengeId, ws.playerUsername);
            break;
        }

        case 'GAME_CANCEL_CHALLENGE': {
            if (!ws.playerUsername) break;
            challengeManager.cancelChallenge(message.challengeId, ws.playerUsername);
            break;
        }

        // ── Game ──
        case 'CREATE_ROOM': {
            const result = gameManager.createRoom(ws, message.playerName);
            ws.send(JSON.stringify(result));
            // Durumu güncelle
            if (ws.playerUsername) {
                onlineTracker.setStatus(ws.playerUsername, 'in_menu', result.roomCode);
            }
            break;
        }

        case 'JOIN_ROOM': {
            const result = gameManager.joinRoom(ws, message.roomCode, message.playerName);
            ws.send(JSON.stringify(result));
            if (ws.playerUsername) {
                onlineTracker.setStatus(ws.playerUsername, 'in_menu', message.roomCode);
            }
            break;
        }

        case 'SELECT_FIELD': {
            const roomCode = gameManager.findRoomByWs(ws);
            if (!roomCode) {
                console.log(`[DEBUG] SELECT_FIELD failed: No room found for ws`);
                ws.send(JSON.stringify({ type: 'ERROR', message: 'Odada değilsiniz!' }));
                return;
            }
            const playerId = gameManager.getPlayerId(roomCode, ws);
            console.log(`[DEBUG] SELECT_FIELD request from player ${playerId} in room ${roomCode} for field ${message.fieldId}`);
            if (playerId !== 1) {
                ws.send(JSON.stringify({ type: 'ERROR', message: 'Sadece oda sahibi saha seçebilir!' }));
                return;
            }
            const selectResult = gameManager.selectField(roomCode, message.fieldId);
            console.log(`[DEBUG] SELECT_FIELD result:`, selectResult);
            break;
        }

        case 'CONFIRM_FIELD': {
            const roomCode = gameManager.findRoomByWs(ws);
            console.log(`[DEBUG] CONFIRM_FIELD request for room ${roomCode}`);
            if (!roomCode) return;
            const confirmResult = gameManager.confirmField(roomCode, message.settings);
            console.log(`[DEBUG] CONFIRM_FIELD result:`, confirmResult);
            // Oyun başladı, durumu güncelle
            if (ws.playerUsername) {
                onlineTracker.setStatus(ws.playerUsername, 'in_game', roomCode);
                broadcastStatusToFriends(ws.playerUsername, 'in_game');
            }
            break;
        }

        case 'SHOOT': {
            const roomCode = gameManager.findRoomByWs(ws);
            if (!roomCode) return;
            const playerId = gameManager.getPlayerId(roomCode, ws);
            if (playerId === null) return;
            gameManager.processShot(roomCode, playerId, message.angle, message.power, message.shotStartTime);
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
                    // Oyun bitti, durumu güncelle
                    if (ws.playerUsername) {
                        onlineTracker.setStatus(ws.playerUsername, 'online');
                        await broadcastStatusToFriends(ws.playerUsername, 'online');
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
// Admin Panel Kontrol İşleyicisi
// ═══════════════════════════════════════════════════

function handleAdminCommand(data, ws) {
    switch (data.cmd) {
        case 'getUsers':
            (async () => {
                if (!isDBConnected()) {
                    ws.send(JSON.stringify({ type: 'usersData', error: 'Veritabanı bağlı değil!' }));
                    return;
                }
                const page = data.page || 1;
                const limit = 50;
                const skip = (page - 1) * limit;
                const totalCount = await Player.countDocuments();
                const users = await Player.find().sort({ createdAt: -1 }).skip(skip).limit(limit).select('-passwordHash -token').lean();
                ws.send(JSON.stringify({ type: 'usersData', users, totalCount, page, totalPages: Math.ceil(totalCount / limit) }));
            })();
            break;
        case 'addUser':
            (async () => {
                if (!isDBConnected()) return;
                try {
                    const existing = await Player.findOne({ username: data.username });
                    if (existing) {
                        ws.send(JSON.stringify({ type: 'adminActionError', message: 'Kullanıcı adı zaten var.' }));
                        return;
                    }
                    const token = require('crypto').randomUUID();
                    const passwordHash = await bcrypt.hash(data.password, 10);
                    await Player.create({ username: data.username, passwordHash, token });
                    ws.send(JSON.stringify({ type: 'adminActionSuccess', message: 'Kullanıcı oluşturuldu.' }));
                    handleAdminCommand({ cmd: 'getUsers', page: 1 }, ws);
                } catch (err) {
                    ws.send(JSON.stringify({ type: 'adminActionError', message: err.message }));
                }
            })();
            break;
        case 'deleteUser':
            (async () => {
                if (!isDBConnected()) return;
                try {
                    await Player.findByIdAndDelete(data.userId);
                    ws.send(JSON.stringify({ type: 'adminActionSuccess', message: 'Kullanıcı silindi.' }));
                    handleAdminCommand({ cmd: 'getUsers', page: 1 }, ws);
                } catch (err) {
                    ws.send(JSON.stringify({ type: 'adminActionError', message: err.message }));
                }
            })();
            break;
        case 'changePassword':
            (async () => {
                if (!isDBConnected()) return;
                try {
                    const passwordHash = await bcrypt.hash(data.newPassword, 10);
                    await Player.findByIdAndUpdate(data.userId, { passwordHash });
                    ws.send(JSON.stringify({ type: 'adminActionSuccess', message: 'Şifre değiştirildi.' }));
                } catch (err) {
                    ws.send(JSON.stringify({ type: 'adminActionError', message: err.message }));
                }
            })();
            break;
        case 'kill':
            console.log("Admin forced shutdown.");
            process.exit(1);
            break;
        case 'start':
        case 'stop':
        case 'restart':
            ws.send(JSON.stringify({ type: 'log', level: 'info', text: 'Bulut sistemlerde (Render), kapatma veya yeniden başlatma işlemleri doğrudan Render paneli üzerinden yapılmalıdır.' }));
            break;
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
    server.listen(port, '0.0.0.0', () => {
        console.log(`[INFO] Oyun sunucusu baslatildi (Port: ${port})`);

        // Stats emisyonu (Manager.js ve Client için)
        setInterval(() => {
            const stats = gameManager.getStats();
            stats.onlinePlayers = onlineTracker.getOnlineCount();
            console.log(`[STATS] ${JSON.stringify(stats)}`);
            broadcastAll({ type: 'GLOBAL_STATS', stats });

            // Send stats to connected admin panels
            wss.clients.forEach(client => {
                if (client.readyState === 1 && client.isAdmin) {
                    client.send(JSON.stringify({
                        type: 'state',
                        data: {
                            isRunning: true,
                            port: port,
                            players: stats.onlinePlayers,
                            rooms: stats.activeRooms,
                            autostart: false,
                            firewallStatus: 'ok'
                        }
                    }));
                }
            });
        }, 2000);

        // Boş odaları temizleme
        setInterval(() => {
            gameManager.clearEmptyRooms();
        }, 60000);

    }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            if (isProduction) {
                console.error(`[ERROR] Port ${port} kullanimda. Production ortaminda port degistirilemez, islem durduruluyor.`);
                process.exit(1);
            } else {
                console.log(`[INFO] Port ${port} kullanimda, ${port + 1} portu deneniyor...`);
                server.removeAllListeners('error');
                startServer(port + 1);
            }
        } else {
            console.error('[ERROR] Sunucu baslatilamadi:', err);
        }
    });
}

// Connect to MongoDB then start server
connectDB().then(async () => {
    // Mevcut oyunculara memberCode ataması (migration)
    await playerService.runMigrations();
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
