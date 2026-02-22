// WebSocket connection to the manager
const ws = new WebSocket(`ws://${location.host}/manager-ws`);

// DOM Elements
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const btnRestart = document.getElementById('btn-restart');
const btnKillManager = document.getElementById('btn-kill-manager');
const valPlayers = document.getElementById('val-players');
const valRooms = document.getElementById('val-rooms');
const valFirewall = document.getElementById('val-firewall');
const btnFixFirewall = document.getElementById('btn-fix-firewall');
const networkUrl = document.getElementById('network-url');
const btnCopyUrl = document.getElementById('btn-copy-url');
const qrCode = document.getElementById('qr-code');
const terminalOutput = document.getElementById('terminal-output');
const btnClearLogs = document.getElementById('btn-clear-logs');
const settingAutostart = document.getElementById('setting-autostart');
const btnCheckUpdate = document.getElementById('btn-check-update');
const updateStatus = document.getElementById('update-status');
const overlay = document.getElementById('overlay');

// ═══════════════════════════════════════════
// WebSocket & Heartbeat
// ═══════════════════════════════════════════

ws.onopen = () => {
    console.log('Manager WS Connected');
    // Start heartbeat
    setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
        }
    }, 1000); // 1-second ping to keep manager alive
};

ws.onclose = () => {
    overlay.classList.remove('hidden'); // Show lost connection overlay
};

ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    if (msg.type === 'state') {
        updateUI(msg.data);
    } else if (msg.type === 'log') {
        appendLog(msg.text, msg.level);
    } else if (msg.type === 'updateStatus') {
        updateStatus.innerHTML = msg.text.replace(/\n/g, '<br>');
    }
};

function sendCmd(cmd, payload = {}) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'cmd', cmd, ...payload }));
    }
}

// ═══════════════════════════════════════════
// UI Updates
// ═══════════════════════════════════════════

function updateUI(state) {
    // Server Status
    if (state.isRunning) {
        statusDot.className = 'dot true';
        statusText.textContent = 'Sunucu Çalışıyor (' + state.port + ')';
        statusText.style.color = '#22c55e';
        btnStart.disabled = true;
        btnStop.disabled = false;
        btnRestart.disabled = false;
    } else {
        statusDot.className = 'dot false';
        statusText.textContent = 'Sunucu Kapalı';
        statusText.style.color = '#ef4444';
        btnStart.disabled = false;
        btnStop.disabled = true;
        btnRestart.disabled = true;
    }

    // Stats
    valPlayers.textContent = state.players || 0;
    valRooms.textContent = state.rooms || 0;

    // Network & QR
    if (state.networkUrl) {
        networkUrl.value = state.networkUrl;
        if (state.qrCodeData) {
            qrCode.src = state.qrCodeData;
            qrCode.style.display = 'inline-block';
        }
    }

    // Firewall Status
    if (state.firewallStatus === 'checking') {
        valFirewall.textContent = 'Kontrol Ediliyor...';
        valFirewall.className = 'card-value';
        btnFixFirewall.classList.add('hidden');
    } else if (state.firewallStatus === 'ok') {
        valFirewall.textContent = 'İzin Verilmiş (Açık)';
        valFirewall.className = 'card-value status-good';
        btnFixFirewall.classList.add('hidden');
    } else if (state.firewallStatus === 'missing') {
        valFirewall.textContent = 'Engelli / Eksik Kural';
        valFirewall.className = 'card-value status-bad';
        btnFixFirewall.classList.remove('hidden');
    }

    // Settings
    settingAutostart.checked = state.autostart;
}

function appendLog(text, level = 'info') {
    const el = document.createElement('div');
    el.className = level;
    // Basic formatting
    el.textContent = text;
    terminalOutput.appendChild(el);

    // Auto-scroll
    if (terminalOutput.scrollHeight - terminalOutput.scrollTop < 600) {
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
    }
}

// ═══════════════════════════════════════════
// Event Listeners
// ═══════════════════════════════════════════

// Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active');
    });
});

// Actions
btnStart.addEventListener('click', () => sendCmd('start'));
btnStop.addEventListener('click', () => sendCmd('stop'));
btnRestart.addEventListener('click', () => sendCmd('restart'));

btnKillManager.addEventListener('click', () => {
    if (confirm('Kapat & Çık: Bu işlem sunucuyu ve arayüzü tamamen kapatacaktır. Emin misiniz?')) {
        sendCmd('kill');
        window.close();
    }
});

btnFixFirewall.addEventListener('click', () => {
    btnFixFirewall.disabled = true;
    btnFixFirewall.textContent = 'Yönetici İzni Bekleniyor...';
    sendCmd('fixFirewall');
});

btnCopyUrl.addEventListener('click', () => {
    networkUrl.select();
    document.execCommand('copy');
    btnCopyUrl.textContent = 'Kopyalandı!';
    setTimeout(() => btnCopyUrl.textContent = 'Kopyala', 2000);
});

btnClearLogs.addEventListener('click', () => {
    terminalOutput.innerHTML = '';
});

// Settings
settingAutostart.addEventListener('change', (e) => {
    sendCmd('setAutostart', { value: e.target.checked });
});

btnCheckUpdate.addEventListener('click', () => {
    updateStatus.textContent = 'Kontrol ediliyor...';
    sendCmd('checkUpdate');
});
