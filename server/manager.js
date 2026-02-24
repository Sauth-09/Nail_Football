/**
 * manager.js - Sunucu Yöneticisi (Admin Panel)
 * 
 * Bu betik, oyun sunucusunu arkaplanda çalıştırır ve 
 * bir web arayüzü (localhost:3001) üzerinden kontrol edilmesini sağlar.
 * Sistem tepsisinde ikon gösterir ve oradan kontrol edilir.
 */

require('dotenv').config();

const express = require('express');
const { WebSocketServer } = require('ws');
const path = require('path');
const { spawn, exec } = require('child_process');
const os = require('os');
const QRCode = require('qrcode');
const fs = require('fs');
const logger = require('./logger');
const trayManager = require('./trayManager');
const { connectDB, isDBConnected } = require('./db');
const Player = require('./models/Player');
const bcrypt = require('bcryptjs');

// Connect to DB for admin panel
connectDB();

const MANAGER_PORT = 3001;
const GAME_PORT = 3000;

const app = express();
app.use(express.static(path.join(__dirname, 'managerUI')));

let gameProcess = null;
let isShuttingDown = false;

// State Data
const state = {
    isRunning: false,
    port: GAME_PORT,
    players: 0,
    rooms: 0,
    networkUrl: '',
    qrCodeData: '',
    firewallStatus: 'checking',
    autostart: false
};

// ═══════════════════════════════════════════
// Yardımcı Fonksiyonlar
// ═══════════════════════════════════════════

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    let bestIP = null;
    let fallbackIP = '127.0.0.1';

    for (const name of Object.keys(interfaces)) {
        const lowerName = name.toLowerCase();
        // Sanal ve VPN bağdaştırıcılarını tamamen atla
        if (lowerName.includes('vmware') ||
            lowerName.includes('virtual') ||
            lowerName.includes('vbox') ||
            lowerName.includes('vethernet') ||
            lowerName.includes('wsl') ||
            lowerName.includes('bluetooth') ||
            lowerName.includes('tailscale') ||
            lowerName.includes('zerotier') ||
            lowerName.includes('loopback')) {
            continue;
        }

        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                // 192.168.56.x bloğu genelde VirtualBox Host-Only ağıdır
                if (iface.address.startsWith('192.168.56.')) continue;
                // 172.16.x.x - 172.31.x.x blokları genelde Docker/WSL ağıdır
                if (iface.address.startsWith('172.')) {
                    fallbackIP = iface.address; // Zorda kalırsak kullanalım
                    continue;
                }

                // Wi-Fi veya normal Ethernet (192.168.1.x vb) önceliklidir
                bestIP = iface.address;
                break;
            }
        }
        if (bestIP) break;
    }

    return bestIP || fallbackIP;
}

function checkFirewall() {
    exec('netsh advfirewall firewall show rule name="CiviFutbolu_LAN"', (err, stdout) => {
        if (err || stdout.includes('No rules match') || stdout.includes('Kural bulunamadi')) {
            state.firewallStatus = 'missing';
        } else {
            state.firewallStatus = 'ok';
        }
        broadcastState();
    });
}

function fixFirewall() {
    state.firewallStatus = 'checking';
    broadcastState();
    const cmd = `powershell -Command "Start-Process cmd -ArgumentList '/c netsh advfirewall firewall add rule name=\\\"CiviFutbolu_LAN\\\" dir=in action=allow protocol=TCP localport=${GAME_PORT}' -Verb RunAs"`;
    exec(cmd, () => {
        setTimeout(checkFirewall, 2000);
    });
}

function checkAutostart() {
    const autostartPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'CiviFutbolu.vbs');
    state.autostart = fs.existsSync(autostartPath);
    broadcastState();
}

function toggleAutostart(value) {
    const startupPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'CiviFutbolu.vbs');
    if (value) {
        // Create VBS shortcut to launch silently
        const projectDir = path.resolve(__dirname, '..', '..');
        const batPath = path.join(projectDir, 'Oyunu_Baslat.bat');
        const vbsContent = `Set WshShell = CreateObject("WScript.Shell")\nWshShell.Run chr(34) & "${batPath}" & Chr(34), 0\nSet WshShell = Nothing`;
        fs.writeFileSync(startupPath, vbsContent);
    } else {
        if (fs.existsSync(startupPath)) {
            fs.unlinkSync(startupPath);
        }
    }
    checkAutostart();
}

// ═══════════════════════════════════════════
// Oyun Sunucusu Kontrolü
// ═══════════════════════════════════════════

function startGameServer() {
    if (gameProcess) return;

    logger.log('info', 'Oyun sunucusu başlatılıyor...');
    gameProcess = spawn('node', [path.join(__dirname, 'server.js')], {
        stdio: ['ignore', 'pipe', 'pipe']
    });

    state.isRunning = true;
    broadcastState();

    gameProcess.stdout.on('data', (data) => {
        const text = data.toString();
        // Check for stats
        const statsMatch = text.match(/\[STATS\] (.*)/);
        if (statsMatch) {
            try {
                const s = JSON.parse(statsMatch[1]);
                state.players = s.players || 0;
                state.rooms = s.rooms || 0;
                broadcastState();
            } catch (e) { }
        } else {
            const trimmed = text.trim();
            if (trimmed) {
                logger.log('info', `[GAME] ${trimmed}`);
                broadcastLog(trimmed, 'info');
            }
        }
    });

    gameProcess.stderr.on('data', (data) => {
        const trimmed = data.toString().trim();
        if (trimmed) {
            logger.log('error', `[GAME] ${trimmed}`);
            broadcastLog(trimmed, 'error');
        }
    });

    gameProcess.on('exit', (code) => {
        const msg = `Sunucu kapandı (Kod: ${code})`;
        logger.log('info', msg);
        broadcastLog(msg, code === 0 ? 'info' : 'error');
        gameProcess = null;
        state.isRunning = false;
        state.players = 0;
        state.rooms = 0;
        broadcastState();
    });
}

function stopGameServer() {
    if (gameProcess) {
        logger.log('info', 'Sunucu durduruluyor...');
        broadcastLog('Sunucu durduruluyor...', 'info');
        gameProcess.kill('SIGINT'); // Trigger graceful shutdown
        setTimeout(() => {
            if (gameProcess) gameProcess.kill('SIGKILL');
        }, 2000);
    }
}

// ═══════════════════════════════════════════
// Web Sunucusu ve WebSocket
// ═══════════════════════════════════════════

const server = app.listen(MANAGER_PORT, '127.0.0.1', async () => {
    state.networkUrl = `http://${getLocalIP()}:${GAME_PORT}`;
    state.qrCodeData = await QRCode.toDataURL(state.networkUrl);

    logger.log('info', `Pano başladı -> http://localhost:${MANAGER_PORT}`);

    // Tarayıcıyı aç
    const startCmd = process.platform === 'win32' ? 'start' : 'open';
    exec(`${startCmd} http://localhost:${MANAGER_PORT}`);

    // Sistem tepsisi ikonu başlat
    trayManager.init({
        gameUrl: state.networkUrl,
        managerPort: MANAGER_PORT,
        onExit: shutdownAll
    });

    checkFirewall();
    checkAutostart();
    startGameServer();
});

const wss = new WebSocketServer({ server, path: '/manager-ws' });

let clients = new Set();

function broadcastState() {
    const msg = JSON.stringify({ type: 'state', data: state });
    for (const client of clients) {
        if (client.readyState === 1) {
            client.send(msg);
        }
    }
}

function broadcastLog(text, level) {
    if (!text) return;
    const msg = JSON.stringify({ type: 'log', text, level });
    for (const client of clients) {
        if (client.readyState === 1) {
            client.send(msg);
        }
    }
}

wss.on('connection', (ws) => {
    clients.add(ws);
    ws.send(JSON.stringify({ type: 'state', data: state }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'ping') {
                // Heartbeat - sadece bağlantı canlılığı için, artık kapatma yok
            } else if (data.type === 'cmd') {
                handleCommand(data, ws);
            }
        } catch (e) { }
    });

    ws.on('close', () => {
        clients.delete(ws);
    });
});

function handleCommand(data, ws) {
    switch (data.cmd) {
        case 'start':
            startGameServer();
            break;
        case 'stop':
            stopGameServer();
            break;
        case 'restart':
            stopGameServer();
            setTimeout(startGameServer, 1000);
            break;
        case 'kill':
            shutdownAll();
            break;
        case 'fixFirewall':
            fixFirewall();
            break;
        case 'setAutostart':
            toggleAutostart(data.value);
            break;
        case 'checkUpdate':
            exec('git fetch && git status', { cwd: path.resolve(__dirname, '..') }, (err, stdout) => {
                ws.send(JSON.stringify({ type: 'updateStatus', text: stdout || (err ? err.message : 'Bilinmeyen hata') }));
            });
            break;
        case 'openGame':
            exec(`start ${state.networkUrl}`);
            break;
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
                    handleCommand({ cmd: 'getUsers', page: 1 }, ws);
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
                    handleCommand({ cmd: 'getUsers', page: 1 }, ws);
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
    }
}

// ═══════════════════════════════════════════
// Temiz Kapanış
// ═══════════════════════════════════════════

function shutdownAll() {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.log('info', 'Sistem kapatılıyor...');

    // Oyun sunucusunu kapat
    if (gameProcess) {
        try { gameProcess.kill('SIGKILL'); } catch (e) { }
    }

    // Tray ikonunu kapat
    trayManager.shutdown();

    // Manager sunucusunu kapat
    server.close();

    logger.log('info', 'Çıkış yapıldı.');

    // Kısa gecikme ile çık (logların yazılması için)
    setTimeout(() => {
        process.exit(0);
    }, 500);
}

// Ctrl+C veya process kill sinyalleri
process.on('SIGINT', shutdownAll);
process.on('SIGTERM', shutdownAll);
process.on('uncaughtException', (err) => {
    logger.log('error', `Yakalanamayan hata: ${err.message}\n${err.stack}`);
    shutdownAll();
});
