/**
 * tournament.js - Turnuva UI ve WebSocket İletişimi
 * 
 * Turnuva listesi, oluşturma, katılma ve bracket görünümü.
 * Faz 3 için iskelet — şimdilik liste ve oluşturma çalışır.
 */

'use strict';

const TournamentUI = (() => {
    function init() {
        // Create tournament modal
        const createBtn = document.getElementById('btn-create-tournament');
        if (createBtn) createBtn.addEventListener('click', showCreateModal);

        const cancelBtn = document.getElementById('btn-tournament-cancel');
        if (cancelBtn) cancelBtn.addEventListener('click', hideCreateModal);

        const confirmBtn = document.getElementById('btn-tournament-create-confirm');
        if (confirmBtn) confirmBtn.addEventListener('click', createTournament);

        // Option button groups
        document.querySelectorAll('.btn-group').forEach(group => {
            group.querySelectorAll('.option-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    group.querySelectorAll('.option-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                });
            });
        });
    }

    function showCreateModal() {
        if (!AuthManager.isLoggedIn()) {
            alert('Turnuva oluşturmak için giriş yapmalısınız!');
            return;
        }
        const modal = document.getElementById('tournament-create-modal');
        if (modal) modal.classList.remove('hidden');
    }

    function hideCreateModal() {
        const modal = document.getElementById('tournament-create-modal');
        if (modal) modal.classList.add('hidden');
    }

    function createTournament() {
        const name = document.getElementById('tournament-name')?.value?.trim();
        if (!name) {
            alert('Turnuva adı gerekli!');
            return;
        }

        const maxPlayers = parseInt(document.querySelector('#tournament-create-modal .form-group:nth-child(2) .option-btn.active')?.dataset.value || '8');
        const goalLimit = parseInt(document.querySelector('#tournament-create-modal .form-group:nth-child(3) .option-btn.active')?.dataset.value || '5');

        NetworkManager.send({
            type: 'TOURNAMENT_CREATE',
            name,
            maxPlayers,
            goalLimit
        });

        hideCreateModal();
    }

    async function loadTournamentList() {
        const container = document.getElementById('tournament-list');
        if (!container) return;
        container.innerHTML = '<div class="lb-loading">Yükleniyor...</div>';

        try {
            const resp = await fetch('/api/tournaments');
            const tournaments = await resp.json();
            renderTournamentList(tournaments);
        } catch (err) {
            container.innerHTML = '<div class="lb-loading">Turnuva listesi yüklenemedi</div>';
        }
    }

    function renderTournamentList(tournaments) {
        const container = document.getElementById('tournament-list');
        if (!container) return;

        if (!tournaments || tournaments.length === 0) {
            container.innerHTML = '<div class="lb-empty">Henüz turnuva yok. İlk turnuvayı sen oluştur!</div>';
            return;
        }

        const statusLabels = {
            waiting: '⏳ Katılım açık',
            in_progress: '🔥 Devam ediyor',
            completed: '✅ Tamamlandı',
            cancelled: '❌ İptal edildi'
        };

        container.innerHTML = tournaments.map(t => {
            const status = statusLabels[t.status] || t.status;
            const count = t.participants ? t.participants.length : 0;
            return `<div class="tournament-card ${t.status}">
                <div class="tournament-card-header">
                    <span class="tournament-name">🏆 ${t.name}</span>
                    <span class="tournament-status">${status}</span>
                </div>
                <div class="tournament-card-info">
                    <span>👥 ${count}/${t.settings.maxPlayers}</span>
                    <span>⚽ ${t.settings.goalLimit} gol</span>
                    <span>📋 Tek Elemeli</span>
                </div>
                ${t.winner ? `<div class="tournament-winner">🥇 ${t.winner}</div>` : ''}
                ${t.status === 'waiting' ? `<button class="menu-btn secondary tournament-join-btn" data-id="${t._id}">KATIL</button>` : ''}
            </div>`;
        }).join('');

        // Bind join buttons
        container.querySelectorAll('.tournament-join-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!AuthManager.isLoggedIn()) {
                    alert('Katılmak için giriş yapmalısınız!');
                    return;
                }
                NetworkManager.send({
                    type: 'TOURNAMENT_JOIN',
                    tournamentId: btn.dataset.id
                });
            });
        });
    }

    return { init, loadTournamentList, showCreateModal, hideCreateModal };
})();
