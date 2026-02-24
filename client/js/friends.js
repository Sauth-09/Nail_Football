/**
 * friends.js - Arkadaş Sistemi UI
 * 
 * Arkadaş listesi, üye kodu ile arama,
 * istek gönderme/kabul/red, meydan okuma.
 */

'use strict';

const FriendsManager = (() => {
    let friendsList = [];
    let pendingIncoming = [];
    let pendingOutgoing = [];
    let onlineFriendsCount = 0;

    /**
     * Arkadaş listesini yenile
     */
    function refreshFriendsList() {
        NetworkManager.send({ type: 'FRIEND_GET_LIST' });
        NetworkManager.send({ type: 'FRIEND_GET_PENDING' });
    }

    /**
     * Üye kodu ile arama yap
     */
    function searchMember(code) {
        if (!code || code.length < 4) return;
        NetworkManager.send({ type: 'FRIEND_SEARCH', memberCode: code });
    }

    /**
     * Arkadaşlık isteği gönder
     */
    function sendFriendRequest(memberCode) {
        NetworkManager.send({ type: 'FRIEND_SEND_REQUEST', targetMemberCode: memberCode });
    }

    /**
     * Arkadaşlık isteğini kabul et
     */
    function acceptRequest(fromUsername) {
        NetworkManager.send({ type: 'FRIEND_ACCEPT_REQUEST', fromUsername });
    }

    /**
     * Arkadaşlık isteğini reddet
     */
    function declineRequest(fromUsername) {
        NetworkManager.send({ type: 'FRIEND_DECLINE_REQUEST', fromUsername });
    }

    /**
     * Arkadaş sil
     */
    function removeFriend(friendUsername) {
        NetworkManager.send({ type: 'FRIEND_REMOVE', friendUsername });
    }

    /**
     * Meydan oku (challenge modalı aç)
     */
    function openChallengeModal(friendUsername) {
        if (typeof ChallengeUI !== 'undefined') {
            ChallengeUI.openChallengeModal(friendUsername);
        }
    }

    /**
     * Gelen arkadaş listesini işle
     */
    function handleFriendList(data) {
        friendsList = data.friends || [];

        // Çevrimiçi sayısı
        onlineFriendsCount = friendsList.filter(f => f.isOnline).length;
        updateOnlineCountBadge();
        renderFriendsList();
    }

    /**
     * Gelen bekleyen istekleri işle
     */
    function handlePendingList(data) {
        pendingIncoming = data.incoming || [];
        pendingOutgoing = data.outgoing || [];
        renderPendingRequests();
    }

    /**
     * Arama sonucu işle
     */
    function handleSearchResult(data) {
        const resultDiv = document.getElementById('friend-search-result');
        if (!resultDiv) return;

        if (data.error) {
            resultDiv.innerHTML = '<div class="search-result-card error"><p>❌ ' + data.error + '</p></div>';
            return;
        }

        if (!data.found) {
            const code = document.getElementById('friend-search-input')?.value || '';
            resultDiv.innerHTML = '<div class="search-result-card error">' +
                '<p>❌ "#' + code + '" koduna ait oyuncu bulunamadı.</p>' +
                '<p class="muted">Kodu doğru yazdığından emin misin?</p></div>';
            return;
        }

        if (data.isFriend) {
            resultDiv.innerHTML = '<div class="search-result-card info">' +
                '<p>ℹ️ ' + data.player.username + ' zaten arkadaş listende!</p></div>';
            return;
        }

        if (data.hasPending) {
            resultDiv.innerHTML = '<div class="search-result-card info">' +
                '<p>ℹ️ ' + data.player.username + '\'e zaten istek gönderdin.</p>' +
                '<p class="muted">Yanıt bekleniyor...</p></div>';
            return;
        }

        const p = data.player;
        const joinDate = p.createdAt ? new Date(p.createdAt).toLocaleDateString('tr-TR', {
            day: 'numeric', month: 'short', year: 'numeric'
        }) : '';

        resultDiv.innerHTML = '<div class="search-result-card found">' +
            '<div class="search-player-info">' +
            '<div class="search-player-name">👤 ' + p.username + ' <span class="member-code-badge">#' + p.memberCode + '</span></div>' +
            '<div class="search-player-stats">' +
            '<span>⭐ Elo: ' + p.rating + '</span>' +
            '<span>🏆 ' + p.totalMatches + ' maç │ %' + p.winRate + ' kazanma</span>' +
            (joinDate ? '<span>📅 ' + joinDate + '</span>' : '') +
            '</div></div>' +
            '<button class="menu-btn primary send-request-btn" data-code="' + p.memberCode + '">📩 Arkadaşlık İsteği Gönder</button>' +
            '</div>';

        const btn = resultDiv.querySelector('.send-request-btn');
        if (btn) {
            btn.addEventListener('click', () => {
                sendFriendRequest(btn.dataset.code);
                btn.disabled = true;
                btn.textContent = '✅ İstek Gönderildi';
            });
        }
    }

    /**
     * Arkadaş durumu değişikliği
     */
    function handleStatusChanged(data) {
        const friend = friendsList.find(f => f.username === data.username);
        if (friend) {
            friend.status = data.status;
            friend.isOnline = data.status !== 'offline';
            onlineFriendsCount = friendsList.filter(f => f.isOnline).length;
            updateOnlineCountBadge();
            renderFriendsList();

            // Çevrimiçi oldu bildirimi
            if (data.status === 'online') {
                NotificationManager.info('🟢 ' + data.username + ' çevrimiçi oldu');
            }
        }
    }

    /**
     * Menüdeki çevrimiçi arkadaş sayısı
     */
    function updateOnlineCountBadge() {
        const badge = document.getElementById('friends-online-count');
        if (badge) {
            badge.textContent = onlineFriendsCount > 0 ? '🟢 ' + onlineFriendsCount : '';
            badge.style.display = onlineFriendsCount > 0 ? 'inline' : 'none';
        }
    }

    /**
     * Arkadaş listesini render et
     */
    function renderFriendsList() {
        const container = document.getElementById('friends-list-container');
        if (!container) return;

        const online = friendsList.filter(f => f.isOnline && f.status !== 'in_game');
        const inGame = friendsList.filter(f => f.status === 'in_game');
        const offline = friendsList.filter(f => !f.isOnline);

        let html = '';

        // Çevrimiçi
        if (online.length > 0 || inGame.length > 0) {
            html += '<div class="friends-section-title">🟢 Çevrimiçi (' + (online.length + inGame.length) + ')</div>';
            online.forEach(f => {
                html += renderFriendCard(f, 'online');
            });
            inGame.forEach(f => {
                html += renderFriendCard(f, 'in_game');
            });
        }

        // Çevrimdışı
        if (offline.length > 0) {
            html += '<div class="friends-section-title">⚫ Çevrimdışı (' + offline.length + ')</div>';
            offline.forEach(f => {
                html += renderFriendCard(f, 'offline');
            });
        }

        if (friendsList.length === 0) {
            html = '<div class="friends-empty">' +
                '<p>👥 Henüz arkadaşın yok</p>' +
                '<p class="muted">Üye kodu ile arkadaş arayarak başla!</p></div>';
        }

        container.innerHTML = html;

        // Event listener'lar
        container.querySelectorAll('.friend-challenge-btn').forEach(btn => {
            btn.addEventListener('click', () => openChallengeModal(btn.dataset.username));
        });

        container.querySelectorAll('.friend-remove-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (confirm(btn.dataset.username + '\'i arkadaşlıktan çıkarmak istediğine emin misin?')) {
                    removeFriend(btn.dataset.username);
                }
            });
        });
    }

    /**
     * Tek bir arkadaş kartı render
     */
    function renderFriendCard(friend, status) {
        const statusIcons = {
            'online': '🟢',
            'in_menu': '🟢',
            'in_game': '🟡',
            'offline': '⚫'
        };
        const statusTexts = {
            'online': 'Çevrimiçi',
            'in_menu': 'Menüde',
            'in_game': '🎮 Oyunda',
            'offline': 'Çevrimdışı'
        };
        const icon = statusIcons[status] || '⚫';
        const statusText = statusTexts[status] || 'Çevrimdışı';

        let actionBtn = '';
        if (status === 'online' || status === 'in_menu') {
            actionBtn = '<button class="friend-challenge-btn menu-btn primary small" data-username="' + friend.username + '">⚔️ Meydan Oku</button>';
        } else if (status === 'in_game') {
            actionBtn = '<span class="friend-status-game">🎮 Oyunda</span>';
        }

        return '<div class="friend-card friend-' + status + '">' +
            '<div class="friend-card-left">' +
            '<span class="friend-status-dot">' + icon + '</span>' +
            '<div class="friend-info">' +
            '<div class="friend-name">' + friend.username + ' <span class="member-code-badge">#' + (friend.memberCode || '') + '</span></div>' +
            '<div class="friend-meta">⭐ ' + (friend.rating || 0) + ' │ ' + statusText + '</div>' +
            '</div></div>' +
            '<div class="friend-card-actions">' +
            actionBtn +
            '<button class="friend-remove-btn icon-btn-sm" data-username="' + friend.username + '" title="Arkadaşlıktan Çıkar">✕</button>' +
            '</div></div>';
    }

    /**
     * Bekleyen istekleri render
     */
    function renderPendingRequests() {
        const container = document.getElementById('friends-pending-container');
        if (!container) return;

        if (pendingIncoming.length === 0) {
            container.innerHTML = '';
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        let html = '<div class="friends-section-title">📩 Bekleyen İstekler (' + pendingIncoming.length + ')</div>';

        pendingIncoming.forEach(req => {
            html += '<div class="pending-request-card">' +
                '<div class="pending-info">' + req.from + ' <span class="member-code-badge">#' + (req.memberCode || '') + '</span></div>' +
                '<div class="pending-actions">' +
                '<button class="menu-btn primary small pending-accept" data-from="' + req.from + '">✅ Kabul</button>' +
                '<button class="menu-btn small pending-decline" data-from="' + req.from + '">❌ Geç</button>' +
                '</div></div>';
        });

        container.innerHTML = html;

        container.querySelectorAll('.pending-accept').forEach(btn => {
            btn.addEventListener('click', () => acceptRequest(btn.dataset.from));
        });
        container.querySelectorAll('.pending-decline').forEach(btn => {
            btn.addEventListener('click', () => declineRequest(btn.dataset.from));
        });
    }

    /**
     * Kopyala butonu için
     */
    function copyMemberCode() {
        const player = AuthManager.getPlayer();
        if (!player || !player.memberCode) return;

        const code = player.memberCode;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(code).then(() => {
                NotificationManager.info('📋 Üye kodu kopyalandı: #' + code);
            });
        } else {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = code;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
            NotificationManager.info('📋 Üye kodu kopyalandı: #' + code);
        }
    }

    /**
     * Network mesajı işle
     */
    function handleMessage(data) {
        switch (data.type) {
            case 'FRIEND_LIST':
                handleFriendList(data);
                break;
            case 'FRIEND_PENDING_LIST':
                handlePendingList(data);
                break;
            case 'FRIEND_SEARCH_RESULT':
                handleSearchResult(data);
                break;
            case 'FRIEND_REQUEST_SENT':
                NotificationManager.info('📩 ' + data.to + '\'e arkadaşlık isteği gönderildi');
                refreshFriendsList();
                break;
            case 'FRIEND_REQUEST_RECEIVED':
                NotificationManager.friendRequest(data.from, data.memberCode, data.rating);
                refreshFriendsList();
                break;
            case 'FRIEND_REQUEST_ACCEPTED':
                NotificationManager.info('🎉 ' + data.username + ' arkadaşlık isteğini kabul etti!');
                refreshFriendsList();
                break;
            case 'FRIEND_REQUEST_DECLINED':
                refreshFriendsList();
                break;
            case 'FRIEND_REMOVED':
                refreshFriendsList();
                break;
            case 'FRIEND_BLOCKED':
                NotificationManager.info('🚫 ' + data.username + ' engellendi');
                refreshFriendsList();
                break;
            case 'FRIEND_UNBLOCKED':
                refreshFriendsList();
                break;
            case 'FRIEND_ERROR':
                NotificationManager.info('⚠️ ' + data.message);
                break;
            case 'FRIEND_STATUS_CHANGED':
                handleStatusChanged(data);
                break;
        }
    }

    return {
        refreshFriendsList,
        searchMember,
        sendFriendRequest,
        acceptRequest,
        declineRequest,
        removeFriend,
        openChallengeModal,
        copyMemberCode,
        handleMessage,
        getOnlineCount: () => onlineFriendsCount
    };
})();
