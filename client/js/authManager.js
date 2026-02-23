/**
 * authManager.js - Basit Oturum Yönetimi
 * 
 * Username + localStorage token ile giriş/kayıt.
 * DB olmadığında misafir modu çalışır.
 */

'use strict';

const AuthManager = (() => {
    let currentPlayer = null;
    let authToken = null;

    function init() {
        authToken = localStorage.getItem('nf_auth_token');
    }

    function hasToken() {
        return !!authToken;
    }

    function getToken() {
        return authToken;
    }

    function getPlayer() {
        return currentPlayer;
    }

    function getUsername() {
        return currentPlayer ? currentPlayer.username : null;
    }

    function isLoggedIn() {
        return currentPlayer !== null;
    }

    /**
     * Register a new player via WebSocket
     */
    async function register(username) {
        if (!NetworkManager.isConnected()) {
            const connected = await NetworkManager.connect();
            if (!connected) {
                handleAuthError('Sunucuya bağlanılamadı. Lütfen tekrar deneyin.');
                return;
            }
        }
        NetworkManager.send({ type: 'AUTH_REGISTER', username });
    }

    /**
     * Login with existing token via WebSocket
     */
    async function loginWithToken() {
        if (!authToken) return false;
        if (!NetworkManager.isConnected()) {
            const connected = await NetworkManager.connect();
            if (!connected) return false;
        }
        NetworkManager.send({ type: 'AUTH_LOGIN', token: authToken });
        return true;
    }

    /**
     * Handle auth success response from server
     */
    function handleAuthSuccess(data) {
        currentPlayer = data.player;
        authToken = data.token;
        localStorage.setItem('nf_auth_token', authToken);

        // Update UI
        const nameEl = document.getElementById('user-display-name');
        const eloEl = document.getElementById('user-display-elo');
        const bar = document.getElementById('user-info-bar');
        if (nameEl) nameEl.textContent = `👤 ${currentPlayer.username}`;
        if (eloEl) eloEl.textContent = `Elo: ${currentPlayer.rating}`;
        if (bar) bar.style.display = 'flex';

        console.log(`[AUTH] Giriş başarılı: ${currentPlayer.username}`);
    }

    /**
     * Handle auth error
     */
    function handleAuthError(message) {
        const errorEl = document.getElementById('auth-error');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }
    }

    /**
     * Skip auth (guest mode)
     */
    function skipAuth() {
        currentPlayer = null;
        authToken = null;
    }

    /**
     * Logout
     */
    function logout() {
        currentPlayer = null;
        authToken = null;
        localStorage.removeItem('nf_auth_token');
        const bar = document.getElementById('user-info-bar');
        if (bar) bar.style.display = 'none';
    }

    /**
     * Update profile display
     */
    function updateProfileDisplay() {
        if (!currentPlayer) return;
        const s = currentPlayer.stats || {};
        const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };

        setEl('profile-username', currentPlayer.username);
        setEl('profile-rating', currentPlayer.rating);
        setEl('profile-matches', s.totalMatches || 0);
        setEl('profile-wins', s.wins || 0);
        setEl('profile-losses', s.losses || 0);
        setEl('profile-winrate', s.totalMatches > 0 ? Math.round((s.wins / s.totalMatches) * 100) + '%' : '0%');
        setEl('profile-goals-scored', s.goalsScored || 0);
        setEl('profile-goals-conceded', s.goalsConceded || 0);
        setEl('profile-streak', s.winStreak || 0);
        setEl('profile-best-streak', s.bestWinStreak || 0);
        setEl('profile-tournaments-won', s.tournamentsWon || 0);
        setEl('profile-tournaments-played', s.tournamentsPlayed || 0);

        // --- AI Stats ---
        const aiStatsStr = localStorage.getItem('nf_ai_stats');
        let aiStats = { wins: 0, matches: 0 };
        if (aiStatsStr) {
            try { aiStats = JSON.parse(aiStatsStr); } catch (e) { }
        }
        setEl('profile-ai-matches', aiStats.matches);
        setEl('profile-ai-wins', aiStats.wins);

        if (currentPlayer.createdAt) {
            const d = new Date(currentPlayer.createdAt);
            setEl('profile-joined', d.toLocaleDateString('tr-TR'));
        }
    }

    /**
     * Load recent matches for profile page
     */
    async function loadRecentMatches() {
        if (!currentPlayer) return;
        try {
            const resp = await fetch(`/api/player/${currentPlayer.username}/matches`);
            const matches = await resp.json();
            const container = document.getElementById('profile-recent-matches');
            if (!container) return;

            if (!matches.length) {
                container.innerHTML = '<p class="muted">Henüz maç yok</p>';
                return;
            }

            container.innerHTML = matches.slice(0, 5).map(m => {
                const isP1 = m.player1.username === currentPlayer.username;
                const myScore = isP1 ? m.player1.score : m.player2.score;
                const oppScore = isP1 ? m.player2.score : m.player1.score;
                const opponent = isP1 ? m.player2.username : m.player1.username;
                const won = m.winner === currentPlayer.username;
                const draw = !m.winner;
                const icon = draw ? '🤝' : (won ? '✅' : '❌');
                return `<div class="recent-match ${won ? 'won' : (draw ? 'draw' : 'lost')}">${icon} ${myScore}-${oppScore} vs ${opponent}</div>`;
            }).join('');
        } catch (err) {
            console.error('[AUTH] Son maçlar yüklenemedi:', err);
        }
    }

    return {
        init, hasToken, getToken, getPlayer, getUsername, isLoggedIn,
        register, loginWithToken,
        handleAuthSuccess, handleAuthError,
        skipAuth, logout,
        updateProfileDisplay, loadRecentMatches
    };
})();
