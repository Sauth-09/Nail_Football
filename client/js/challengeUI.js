/**
 * challengeUI.js - Oyun Daveti (Meydan Okuma) UI
 * 
 * Challenge modalı, bekleme ekranı, VS ekranı.
 */

'use strict';

const ChallengeUI = (() => {
    let currentChallengeId = null;
    let waitingTimer = null;
    let waitingInterval = null;

    /**
     * Meydan Okuma ayar modalını aç
     */
    function openChallengeModal(targetUsername) {
        const modal = document.getElementById('challenge-modal');
        if (!modal) return;

        modal.querySelector('.challenge-target-name').textContent = targetUsername;
        modal.dataset.target = targetUsername;

        // Varsayılan seçimler
        const fieldBtns = modal.querySelectorAll('.challenge-field-btn');
        fieldBtns.forEach(b => b.classList.remove('selected'));
        if (fieldBtns[0]) fieldBtns[0].classList.add('selected');

        const goalBtns = modal.querySelectorAll('.challenge-goal-btn');
        goalBtns.forEach(b => b.classList.remove('selected'));
        const defaultGoal = modal.querySelector('.challenge-goal-btn[data-goal="5"]');
        if (defaultGoal) defaultGoal.classList.add('selected');

        modal.classList.remove('hidden');
    }

    /**
     * Challenge gönder
     */
    function sendChallenge() {
        const modal = document.getElementById('challenge-modal');
        if (!modal) return;

        const target = modal.dataset.target;
        const selectedField = modal.querySelector('.challenge-field-btn.selected');
        const selectedGoal = modal.querySelector('.challenge-goal-btn.selected');

        if (!selectedField || !selectedGoal) {
            NotificationManager.info('⚠️ Saha ve gol limiti seçmelisin');
            return;
        }

        NetworkManager.send({
            type: 'GAME_CHALLENGE',
            targetUsername: target,
            fieldId: selectedField.dataset.field,
            goalLimit: parseInt(selectedGoal.dataset.goal)
        });

        modal.classList.add('hidden');
    }

    /**
     * Challenge gönderildi → Bekleme ekranı göster
     */
    function showWaitingScreen(data) {
        currentChallengeId = data.challengeId;

        const screen = document.getElementById('challenge-waiting-screen');
        if (!screen) return;

        const fieldNames = {
            'classic': 'Klasik', 'zigzag': 'Zigzag', 'diamond': 'Elmas',
            'spiral': 'Spiral', 'chaotic': 'Kaotik', 'castle': 'Kale',
            'random': 'Rastgele'
        };

        screen.querySelector('.waiting-opponent-name').textContent = data.to;
        screen.querySelector('.waiting-field').textContent = 'Saha: ' + (fieldNames[data.fieldId] || data.fieldId);
        screen.querySelector('.waiting-goal').textContent = 'Gol Limiti: ' + data.goalLimit;

        // Geri sayım
        let remaining = Math.ceil((data.expiresIn || 30000) / 1000);
        const timerEl = screen.querySelector('.waiting-timer-text');
        const barEl = screen.querySelector('.waiting-timer-bar');

        if (timerEl) timerEl.textContent = remaining + ' saniye';
        if (barEl) {
            barEl.style.width = '100%';
            barEl.style.transition = 'width ' + remaining + 's linear';
            requestAnimationFrame(() => { barEl.style.width = '0%'; });
        }

        waitingInterval = setInterval(() => {
            remaining--;
            if (timerEl) timerEl.textContent = remaining + ' saniye';
            if (remaining <= 0) clearInterval(waitingInterval);
        }, 1000);

        // Tüm ekranları gizle, bekleme ekranını göster
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        screen.classList.add('active');
    }

    /**
     * Bekleme ekranını kapat
     */
    function hideWaitingScreen() {
        if (waitingInterval) clearInterval(waitingInterval);
        if (waitingTimer) clearTimeout(waitingTimer);

        const screen = document.getElementById('challenge-waiting-screen');
        if (screen) screen.classList.remove('active');
    }

    /**
     * Challenge kabul edildi → VS ekranı göster
     */
    function showVSScreen(data) {
        hideWaitingScreen();
        NotificationManager.dismiss('gc_' + data.challengeId);

        const screen = document.getElementById('challenge-vs-screen');
        if (!screen) return;

        const player = AuthManager.getPlayer();
        const fieldNames = {
            'classic': 'Klasik', 'zigzag': 'Zigzag', 'diamond': 'Elmas',
            'spiral': 'Spiral', 'chaotic': 'Kaotik', 'castle': 'Kale',
            'random': 'Rastgele'
        };

        screen.querySelector('.vs-player1-name').textContent = player ? player.username : 'Sen';
        screen.querySelector('.vs-player1-code').textContent = '#' + (player ? player.memberCode : '');
        screen.querySelector('.vs-player1-rating').textContent = '⭐ ' + (player ? player.rating : 0);

        screen.querySelector('.vs-player2-name').textContent = data.opponent;
        screen.querySelector('.vs-player2-code').textContent = '#' + (data.opponentMemberCode || '');
        screen.querySelector('.vs-player2-rating').textContent = '⭐ ' + (data.opponentRating || 0);

        screen.querySelector('.vs-field').textContent = 'Saha: ' + (fieldNames[data.fieldId] || data.fieldId) + ' ⚽';
        screen.querySelector('.vs-goal-limit').textContent = 'Gol Limiti: ' + data.goalLimit;

        // Tüm ekranları gizle, VS ekranını göster
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        screen.classList.add('active');

        // 3 saniye geri sayım → Oyuna yönlendir
        const countdownEl = screen.querySelector('.vs-countdown');
        let count = 3;
        if (countdownEl) countdownEl.textContent = count + '...';

        const countInterval = setInterval(() => {
            count--;
            if (countdownEl) {
                if (count > 0) {
                    countdownEl.textContent = count + '...';
                } else {
                    countdownEl.textContent = 'MAÇ BAŞLADI! ⚽';
                }
            }
            if (count <= 0) {
                clearInterval(countInterval);
                // Oyuna geç
                setTimeout(() => {
                    startChallengeGame(data);
                }, 500);
            }
        }, 1000);
    }

    /**
     * Challenge oyununu başlat
     */
    function startChallengeGame(data) {
        const screen = document.getElementById('challenge-vs-screen');
        if (screen) screen.classList.remove('active');

        // Oyun modunu ayarla ve başlat
        if (typeof Game !== 'undefined') {
            Game.setMode('multiplayer');

            // Oda oluştur/katıl simülasyonu - aslında server zaten odayı oluşturdu
            // Client'ın bu odaya katılması gerekecek
            const player = AuthManager.getPlayer();
            const playerName = player ? player.username : 'Oyuncu';

            // Direkt oda koduna katıl
            NetworkManager.joinRoom(data.roomCode, playerName);
        }
    }

    /**
     * Challenge reddedildi
     */
    function handleDeclined() {
        hideWaitingScreen();
        NotificationManager.info('🙁 Rakip şu an müsait değil');

        // Ana menüye dön
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('main-menu')?.classList.add('active');
    }

    /**
     * Challenge süresi doldu
     */
    function handleExpired() {
        hideWaitingScreen();
        NotificationManager.info('⏱️ Davet süresi doldu');

        // Eğer aktif bildirim varsa kaldır
        if (currentChallengeId) {
            NotificationManager.dismiss('gc_' + currentChallengeId);
        }

        // Ana menüye dön
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('main-menu')?.classList.add('active');
    }

    /**
     * Challenge iptal edildi
     */
    function handleCancelled(data) {
        NotificationManager.dismiss('gc_' + data.challengeId);
        NotificationManager.info('ℹ️ Davet iptal edildi');
    }

    /**
     * İptal et (bekleme ekranından)
     */
    function cancelChallenge() {
        if (currentChallengeId) {
            NetworkManager.send({ type: 'GAME_CANCEL_CHALLENGE', challengeId: currentChallengeId });
        }
        hideWaitingScreen();

        // Ana menüye dön
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('main-menu')?.classList.add('active');
    }

    /**
     * Network mesajı işle
     */
    function handleMessage(data) {
        switch (data.type) {
            case 'GAME_CHALLENGE_SENT':
                showWaitingScreen(data);
                break;
            case 'GAME_CHALLENGE_RECEIVED':
                NotificationManager.gameChallenge(data);
                break;
            case 'GAME_CHALLENGE_ACCEPTED':
                showVSScreen(data);
                break;
            case 'GAME_CHALLENGE_DECLINED':
                handleDeclined();
                break;
            case 'GAME_CHALLENGE_EXPIRED':
                handleExpired();
                break;
            case 'GAME_CHALLENGE_CANCELLED':
                handleCancelled(data);
                break;
            case 'GAME_CHALLENGE_ERROR':
                NotificationManager.info('⚠️ ' + data.message);
                break;
        }
    }

    return {
        openChallengeModal,
        sendChallenge,
        cancelChallenge,
        handleMessage,
        showVSScreen,
        hideWaitingScreen
    };
})();
