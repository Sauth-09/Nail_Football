/**
 * tournament.js - Turnuva UI ve WebSocket İletişimi
 * 
 * Turnuva listesi, oluşturma, katılma, bracket görünümü.
 * Tek elemeli bracket HTML/CSS ile render edilir.
 */

'use strict';

const TournamentUI = (() => {
    let currentTournament = null;

    function init() {
        // Create tournament modal
        const createBtn = document.getElementById('btn-create-tournament');
        if (createBtn) createBtn.addEventListener('click', showCreateModal);

        const cancelBtn = document.getElementById('btn-tournament-cancel');
        if (cancelBtn) cancelBtn.addEventListener('click', hideCreateModal);

        const confirmBtn = document.getElementById('btn-tournament-create-confirm');
        if (confirmBtn) confirmBtn.addEventListener('click', createTournament);

        // Option button groups
        document.querySelectorAll('#tournament-create-modal .btn-group').forEach(group => {
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
        if (!name) { alert('Turnuva adı gerekli!'); return; }

        const maxPlayersBtn = document.querySelector('#tournament-create-modal .form-group:nth-child(2) .option-btn.active');
        const goalLimitBtn = document.querySelector('#tournament-create-modal .form-group:nth-child(3) .option-btn.active');
        const maxPlayers = parseInt(maxPlayersBtn?.dataset.value || '8');
        const goalLimit = parseInt(goalLimitBtn?.dataset.value || '5');

        NetworkManager.send({
            type: 'TOURNAMENT_CREATE',
            name, maxPlayers, goalLimit
        });

        hideCreateModal();
        document.getElementById('tournament-name').value = '';
    }

    // ── REST API ile turnuva listesi ──
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

        const currentUser = AuthManager.getUsername();

        container.innerHTML = tournaments.map(t => {
            const status = statusLabels[t.status] || t.status;
            const count = t.participants ? t.participants.length : 0;
            const isCreator = (t.createdBy === currentUser);
            const isParticipant = t.participants?.some(p => p.username === currentUser);
            const canStart = isCreator && t.status === 'waiting' && count >= 2;

            return `<div class="tournament-card ${t.status}" data-id="${t._id}">
                <div class="tournament-card-header">
                    <span class="tournament-name">🏆 ${t.name}</span>
                    <span class="tournament-status">${status}</span>
                </div>
                <div class="tournament-card-info">
                    <span>👥 ${count}/${t.settings.maxPlayers}</span>
                    <span>⚽ ${t.settings.goalLimit} gol</span>
                    <span>📋 Tek Elemeli</span>
                </div>
                ${t.winner ? `<div class="tournament-winner">🥇 Şampiyon: ${t.winner}</div>` : ''}
                <div class="tournament-card-actions">
                    ${t.status === 'waiting' && !isParticipant ? `<button class="menu-btn secondary tournament-join-btn" data-id="${t._id}">KATIL</button>` : ''}
                    ${t.status === 'waiting' && isParticipant && !isCreator ? `<button class="menu-btn tournament-leave-btn" data-id="${t._id}">AYRIL</button>` : ''}
                    ${canStart ? `<button class="menu-btn primary tournament-start-btn" data-id="${t._id}">BAŞLAT</button>` : ''}
                    ${t.status === 'in_progress' || t.status === 'completed' ? `<button class="menu-btn secondary tournament-view-btn" data-id="${t._id}">BRACKET</button>` : ''}
                </div>
                ${t.participants ? `<div class="tournament-participants">${t.participants.map(p => `<span class="participant-badge ${p.eliminated ? 'eliminated' : ''}">${p.username}</span>`).join('')}</div>` : ''}
            </div>`;
        }).join('');

        // Bind buttons
        container.querySelectorAll('.tournament-join-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!AuthManager.isLoggedIn()) { alert('Giriş yapmalısınız!'); return; }
                NetworkManager.send({ type: 'TOURNAMENT_JOIN', tournamentId: btn.dataset.id });
            });
        });
        container.querySelectorAll('.tournament-leave-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                NetworkManager.send({ type: 'TOURNAMENT_LEAVE', tournamentId: btn.dataset.id });
            });
        });
        container.querySelectorAll('.tournament-start-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                NetworkManager.send({ type: 'TOURNAMENT_START', tournamentId: btn.dataset.id });
            });
        });
        container.querySelectorAll('.tournament-view-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                try {
                    const resp = await fetch(`/api/tournament/${btn.dataset.id}`);
                    const t = await resp.json();
                    if (t && t.rounds) showBracketView(t);
                } catch (err) {
                    console.error('[TOURNAMENT] Bracket yüklenemedi');
                }
            });
        });
    }

    // ── Bracket Görünümü ──
    function showBracketView(tournament) {
        currentTournament = tournament;
        const container = document.getElementById('tournament-list');
        if (!container) return;

        let html = `<div class="bracket-header">
            <h3>🏆 ${tournament.name}</h3>
            ${tournament.winner ? `<div class="bracket-champion">🥇 Şampiyon: ${tournament.winner}</div>` : ''}
            <button class="menu-btn bracket-back-btn" onclick="TournamentUI.loadTournamentList()">← Listeye Dön</button>
        </div>
        <div class="bracket-container">`;

        if (tournament.rounds) {
            tournament.rounds.forEach(round => {
                html += `<div class="bracket-round">
                    <div class="bracket-round-title">${round.roundName}</div>`;
                round.matches.forEach(match => {
                    const p1Class = match.winner === match.player1 ? 'match-winner' : (match.winner ? 'match-loser' : '');
                    const p2Class = match.winner === match.player2 ? 'match-winner' : (match.winner ? 'match-loser' : '');
                    html += `<div class="bracket-match ${match.status}">
                        <div class="bracket-player ${p1Class}">
                            <span>${match.player1 || 'BYE'}</span>
                            <span class="bracket-score">${match.status === 'completed' ? match.score1 : '-'}</span>
                        </div>
                        <div class="bracket-player ${p2Class}">
                            <span>${match.player2 || 'BYE'}</span>
                            <span class="bracket-score">${match.status === 'completed' ? match.score2 : '-'}</span>
                        </div>
                    </div>`;
                });
                html += '</div>';
            });
        }

        html += '</div>';
        container.innerHTML = html;
    }

    // ── WS Event Handlers ──
    function handleTournamentUpdate(tournament) {
        // Listeyi yenile
        loadTournamentList();
    }

    function handleTournamentStarted(tournament) {
        loadTournamentList();
    }

    function handleTournamentError(message) {
        alert(message);
    }

    return {
        init, loadTournamentList, showCreateModal, hideCreateModal,
        showBracketView,
        handleTournamentUpdate, handleTournamentStarted, handleTournamentError
    };
})();
