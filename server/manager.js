/**
 * manager.js - Sunucu Yöneticisi (Admin Panel)
 * 
 * Bu betik, oyun sunucusunu arkaplanda çalıştırır ve 
 * bir web arayüzü (1localhost:3001) üzerinden kontrol edilmesini sağlar.
 * Arayüz kapatıldığında oyunu da kapatır (Heartbeat sistemi).
 */

const express = require('express');
const { WebSocketServer } = require('ws');
const path = require('path');
const { spawn, exec } = require('child_process');
const os = require('os');
const QRCode = require('qrcode');
const fs = require('fs');

const MANAGER_PORT = 3001;
const GAME_PORT = 3000;

const app = express();
app.use(express.static(path.join(__dirname, 'managerUI')));

let gameProcess = null;
let lastHeartbeat = Date.now();
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
    for (const name of Object.keys(interfaces)) {
        if (name.toLowerCase().includes('vmware') || name.toLowerCase().includes('virtualbox')) continue;
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
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
    const cmd = `powershell -Command "Start-Process cmd -ArgumentList '/c netsh advfirewall firewall add rule name=\\"CiviFutbolu_LAN\\" dir=in action=allow protocol=TCP localport=${GAME_PORT}' -Verb RunAs"`;
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

    console.log('[MANAGER] Oyun sunucusu baslatiliyor...');
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
            broadcastLog(text.trim(), 'info');
        }
    });

    gameProcess.stderr.on('data', (data) => {
        broadcastLog(data.toString().trim(), 'error');
    });

    gameProcess.on('exit', (code) => {
        broadcastLog(`Sunucu kapandi (Kod: ${code})`, 'error');
        gameProcess = null;
        state.isRunning = false;
        state.players = 0;
        state.rooms = 0;
        broadcastState();
    });
}

function stopGameServer() {
    if (gameProcess) {
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

    console.log(`[MANAGER] Pano basladi -> http://localhost:${MANAGER_PORT}`);

    // Tarayıcıyı aç
    const startCmd = process.platform === 'win32' ? 'start' : 'open';
    exec(`${startCmd} http://localhost:${MANAGER_PORT}`);

    checkFirewall();
    checkAutostart();
    startGameServer();
});

const wss = new WebSocketServer({ server, path: '/manager-ws' });

let clients = new Set();

function broadcastState() {
    const msg = JSON.stringify({ type: 'state', data: state });
    for (const client of clients) {
        client.send(msg);
    }
}

function broadcastLog(text, level) {
    if (!text) return;
    const msg = JSON.stringify({ type: 'log', text, level });
    for (const client of clients) {
        client.send(msg);
    }
}

wss.on('connection', (ws) => {
    clients.add(ws);
    ws.send(JSON.stringify({ type: 'state', data: state }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'ping') {
                lastHeartbeat = Date.now();
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
                ws.send(JSON.stringify({ type: 'updateStatus', text: stdout || err.message }));
            });
            break;
    }
}

// ═══════════════════════════════════════════
// Heartbeat Kapatıcısı (Güvenlik)
// ═══════════════════════════════════════════

// Arayüz tarayıcıda kapatılırsa Ping gelmez, 3 saniye sonra her şeyi kapatır
setInterval(() => {
    if (isShuttingDown) return;
    if (Date.now() - lastHeartbeat > 3000) {
        console.log('[MANAGER] Arayuz kapandi, sistem sonlandiriliyor...');
        shutdownAll();
    }
}, 1000);

function shutdownAll() {
    isShuttingDown = true;
    if (gameProcess) gameProcess.kill('SIGKILL');
    console.log('[MANAGER] Cikiliyor...');
    process.exit(0);
}
