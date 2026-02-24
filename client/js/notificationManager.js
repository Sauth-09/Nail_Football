/**
 * notificationManager.js - Bildirim Sistemi
 * 
 * Oyun daveti, arkadaşlık isteği ve bilgi bildirimleri.
 * Her ekranın üstünde gösterilir (fixed position, yüksek z-index).
 */

'use strict';

const NotificationManager = (() => {
    let container = null;
    const activeNotifications = [];
    const MAX_VISIBLE = 3;

    function init() {
        if (container) return;
        container = document.createElement('div');
        container.id = 'notification-container';
        container.className = 'notification-container';
        document.body.appendChild(container);
    }

    /**
     * Bilgi bildirimi (otomatik kapanır)
     */
    function info(message, duration = 3000) {
        init();
        show({
            id: 'info_' + Date.now(),
            type: 'info',
            message: message,
            duration: duration,
            actions: null
        });
    }

    /**
     * Arkadaşlık isteği bildirimi
     */
    function friendRequest(from, memberCode, rating) {
        init();
        show({
            id: 'fr_' + from,
            type: 'friend_request',
            message: '📩 ' + from + ' (#' + memberCode + ') arkadaşlık isteği gönderdi',
            subtext: '⭐ Elo: ' + rating,
            duration: 0,  // Manuel kapatılır
            actions: [
                {
                    label: '✅ Kabul',
                    style: 'accept',
                    callback: () => {
                        NetworkManager.send({ type: 'FRIEND_ACCEPT_REQUEST', fromUsername: from });
                        dismiss('fr_' + from);
                    }
                },
                {
                    label: '❌ Reddet',
                    style: 'decline',
                    callback: () => {
                        NetworkManager.send({ type: 'FRIEND_DECLINE_REQUEST', fromUsername: from });
                        dismiss('fr_' + from);
                    }
                }
            ]
        });
    }

    /**
     * Oyun daveti bildirimi (30 sn süreli)
     */
    function gameChallenge(data) {
        init();
        const fieldNames = {
            'classic': 'Klasik', 'zigzag': 'Zigzag', 'diamond': 'Elmas',
            'spiral': 'Spiral', 'chaotic': 'Kaotik', 'castle': 'Kale',
            'random': 'Rastgele'
        };
        const fieldName = fieldNames[data.fieldId] || data.fieldId;

        show({
            id: 'gc_' + data.challengeId,
            type: 'game_challenge',
            message: '⚔️ ' + data.from + ' seni maça davet ediyor!',
            subtext: 'Saha: ' + fieldName + ' │ Gol: ' + data.goalLimit + ' │ Elo: ' + data.fromRating,
            duration: data.expiresIn || 30000,
            countdown: true,
            actions: [
                {
                    label: '✅ Kabul',
                    style: 'accept',
                    callback: () => {
                        NetworkManager.send({ type: 'GAME_ACCEPT_CHALLENGE', challengeId: data.challengeId });
                        dismiss('gc_' + data.challengeId);
                    }
                },
                {
                    label: '❌ Reddet',
                    style: 'decline',
                    callback: () => {
                        NetworkManager.send({ type: 'GAME_DECLINE_CHALLENGE', challengeId: data.challengeId });
                        dismiss('gc_' + data.challengeId);
                    }
                }
            ]
        });
    }

    /**
     * Belirli bir bildirimi kaldır
     */
    function dismiss(id) {
        const idx = activeNotifications.findIndex(n => n.id === id);
        if (idx === -1) return;

        const notif = activeNotifications[idx];
        if (notif.element) {
            notif.element.classList.add('notification-hiding');
            setTimeout(() => {
                if (notif.element && notif.element.parentNode) {
                    notif.element.remove();
                }
            }, 300);
        }
        if (notif.timer) clearTimeout(notif.timer);
        if (notif.countdownInterval) clearInterval(notif.countdownInterval);
        activeNotifications.splice(idx, 1);
    }

    /**
     * Tüm bildirimleri kaldır
     */
    function dismissAll() {
        [...activeNotifications].forEach(n => dismiss(n.id));
    }

    /**
     * Bildirim göster
     */
    function show(config) {
        init();

        // Aynı ID'li varsa önce kaldır
        dismiss(config.id);

        // Limit kontrolü
        while (activeNotifications.length >= MAX_VISIBLE) {
            dismiss(activeNotifications[0].id);
        }

        const el = document.createElement('div');
        el.className = 'notification notification-' + config.type + ' notification-entering';

        // İçerik
        let html = '<div class="notification-body">';
        html += '<div class="notification-message">' + config.message + '</div>';
        if (config.subtext) {
            html += '<div class="notification-subtext">' + config.subtext + '</div>';
        }
        html += '</div>';

        // Butonlar
        if (config.actions && config.actions.length > 0) {
            html += '<div class="notification-actions">';
            config.actions.forEach((action, i) => {
                html += '<button class="notification-btn notification-btn-' + action.style + '" data-action="' + i + '">' + action.label + '</button>';
            });
            html += '</div>';
        }

        // Geri sayım barı
        if (config.countdown && config.duration > 0) {
            html += '<div class="notification-countdown">';
            html += '<div class="notification-countdown-bar"></div>';
            html += '<span class="notification-countdown-text">' + Math.ceil(config.duration / 1000) + 'sn</span>';
            html += '</div>';
        }

        el.innerHTML = html;

        // Buton event listener'ları
        if (config.actions) {
            config.actions.forEach((action, i) => {
                const btn = el.querySelector('[data-action="' + i + '"]');
                if (btn) {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        action.callback();
                    });
                }
            });
        }

        container.appendChild(el);

        // Animasyon
        requestAnimationFrame(() => {
            el.classList.remove('notification-entering');
        });

        const notifData = {
            id: config.id,
            element: el,
            timer: null,
            countdownInterval: null
        };

        // Geri sayım
        if (config.countdown && config.duration > 0) {
            const bar = el.querySelector('.notification-countdown-bar');
            const text = el.querySelector('.notification-countdown-text');
            const startTime = Date.now();
            const totalDuration = config.duration;

            if (bar) {
                bar.style.transition = 'width ' + (totalDuration / 1000) + 's linear';
                requestAnimationFrame(() => {
                    bar.style.width = '0%';
                });
            }

            notifData.countdownInterval = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const remaining = Math.max(0, totalDuration - elapsed);
                if (text) text.textContent = Math.ceil(remaining / 1000) + 'sn';
                if (remaining <= 0) {
                    clearInterval(notifData.countdownInterval);
                }
            }, 1000);
        }

        // Otomatik kapatma
        if (config.duration > 0) {
            notifData.timer = setTimeout(() => {
                dismiss(config.id);
            }, config.duration);
        }

        activeNotifications.push(notifData);
    }

    return {
        init,
        info,
        friendRequest,
        gameChallenge,
        dismiss,
        dismissAll,
        show
    };
})();
