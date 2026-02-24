/**
 * onlineTracker.js - Çevrimiçi Durum Takibi
 * 
 * Her oyuncunun bağlantı durumunu RAM'de tutar.
 * DB'ye yazmaz, geçici veridir.
 */

'use strict';

class OnlineTracker {
    constructor() {
        // username → { socketId, ws, status, currentRoom, connectedAt }
        this.users = new Map();
        // ws → username (reverse lookup)
        this.wsToUser = new Map();
    }

    /**
     * Oyuncuyu çevrimiçi olarak işaretle
     */
    setOnline(username, ws) {
        this.users.set(username, {
            ws: ws,
            status: 'online',       // 'online', 'in_menu', 'in_game'
            currentRoom: null,
            connectedAt: Date.now()
        });
        this.wsToUser.set(ws, username);
    }

    /**
     * Oyuncuyu çevrimdışı olarak işaretle
     */
    setOffline(username) {
        const user = this.users.get(username);
        if (user) {
            this.wsToUser.delete(user.ws);
        }
        this.users.delete(username);
    }

    /**
     * Oyuncunun durumunu güncelle
     */
    setStatus(username, status, roomCode = null) {
        const user = this.users.get(username);
        if (user) {
            user.status = status;
            user.currentRoom = roomCode;
        }
    }

    /**
     * Oyuncu çevrimiçi mi?
     */
    isOnline(username) {
        return this.users.has(username);
    }

    /**
     * Oyuncunun durumunu getir
     */
    getStatus(username) {
        const user = this.users.get(username);
        if (!user) return 'offline';
        return user.status;
    }

    /**
     * Oyuncunun WebSocket bağlantısını getir
     */
    getWs(username) {
        const user = this.users.get(username);
        return user ? user.ws : null;
    }

    /**
     * WebSocket'ten kullanıcı adını bul
     */
    getUsernameByWs(ws) {
        return this.wsToUser.get(ws) || null;
    }

    /**
     * WebSocket üzerinden mesaj gönder
     */
    sendTo(username, data) {
        const ws = this.getWs(username);
        if (ws && ws.readyState === 1) { // OPEN
            ws.send(JSON.stringify(data));
            return true;
        }
        return false;
    }

    /**
     * Bir oyuncunun arkadaşlarından çevrimiçi olanları getir
     */
    getOnlineFriends(friendsList) {
        return friendsList.map(friend => ({
            username: friend.username,
            memberCode: friend.memberCode,
            addedAt: friend.addedAt,
            status: this.getStatus(friend.username),
            isOnline: this.isOnline(friend.username)
        }));
    }

    /**
     * Tüm çevrimiçi kullanıcı sayısı
     */
    getOnlineCount() {
        return this.users.size;
    }

    /**
     * WS bağlantısı koptuğunda temizlik
     */
    handleDisconnect(ws) {
        const username = this.wsToUser.get(ws);
        if (username) {
            this.setOffline(username);
        }
        return username;
    }
}

// Tek global instance
const onlineTracker = new OnlineTracker();
module.exports = onlineTracker;
