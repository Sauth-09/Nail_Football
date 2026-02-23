/**
 * leaderboard.js - Skor Tablosu UI
 * 
 * Haftalık / Aylık / Tüm Zamanlar skor tablosu.
 * REST API'den veri çeker ve tabloya render eder.
 */

'use strict';

const LeaderboardUI = (() => {
    let currentType = 'weekly';

    function init() {
        // Tab click handlers
        document.querySelectorAll('.lb-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentType = tab.dataset.type;
                loadLeaderboard(currentType);
            });
        });
    }

    async function loadLeaderboard(type) {
        const container = document.getElementById('lb-table-container');
        if (!container) return;
        container.innerHTML = '<div class="lb-loading">Yükleniyor...</div>';

        try {
            const resp = await fetch(`/api/leaderboard?type=${type}`);
            const data = await resp.json();
            renderLeaderboard(data, type);
        } catch (err) {
            container.innerHTML = '<div class="lb-loading">Yüklenemedi. Tekrar deneyin.</div>';
            console.error('[LEADERBOARD] Hata:', err);
        }
    }

    function renderLeaderboard(data, type) {
        const container = document.getElementById('lb-table-container');
        const periodEl = document.getElementById('lb-period');
        if (!container) return;

        // Period display
        if (periodEl && data.periodStart && type !== 'alltime') {
            const start = new Date(data.periodStart);
            const end = data.periodEnd ? new Date(data.periodEnd) : new Date();
            const opts = { day: 'numeric', month: 'short' };
            periodEl.textContent = `📅 ${start.toLocaleDateString('tr-TR', opts)} - ${end.toLocaleDateString('tr-TR', opts)}`;
        } else if (periodEl) {
            periodEl.textContent = type === 'alltime' ? '📅 Tüm zamanlar' : '';
        }

        const entries = data.entries || [];
        if (entries.length === 0) {
            container.innerHTML = '<div class="lb-empty">Henüz veri yok. Maç oynayın!</div>';
            return;
        }

        const rankIcons = { 1: '🥇', 2: '🥈', 3: '🥉' };
        const currentUser = AuthManager.getUsername();

        let html = `<table class="lb-table">
            <thead><tr>
                <th>#</th><th>Oyuncu</th><th>M</th><th>G</th><th>Mg</th><th>Puan</th><th>Elo</th>
            </tr></thead><tbody>`;

        entries.forEach(e => {
            const isMe = e.username === currentUser;
            const rankDisplay = rankIcons[e.rank] || e.rank;
            html += `<tr class="${isMe ? 'lb-me' : ''} ${e.rank <= 3 ? 'lb-top' : ''}">
                <td>${rankDisplay}</td>
                <td>${isMe ? '⭐ ' : ''}${e.username}</td>
                <td>${e.matchesPlayed}</td>
                <td>${e.wins}</td>
                <td>${e.losses}</td>
                <td><strong>${e.points}</strong></td>
                <td>${e.rating}</td>
            </tr>`;
        });

        html += '</tbody></table>';
        container.innerHTML = html;

        // My rank
        if (currentUser) {
            const myEntry = entries.find(e => e.username === currentUser);
            const myRankEl = document.getElementById('lb-my-rank');
            if (myRankEl && myEntry) {
                myRankEl.style.display = 'block';
                myRankEl.innerHTML = `📍 Sen (${currentUser}) → #${myEntry.rank} | ${myEntry.matchesPlayed} maç | ${myEntry.rating} Elo`;
            }
        }
    }

    return { init, loadLeaderboard };
})();
