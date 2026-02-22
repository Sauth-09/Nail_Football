/**
 * networkManager.js - WebSocket İletişim Yönetimi
 * 
 * WebSocket bağlantısı, oda oluşturma/katılma,
 * mesajlaşma ve otomatik yeniden bağlanma (exponential backoff).
 */

'use strict';

const NetworkManager = (() => {
    /** @type {WebSocket|null} */
    let ws = null;

    /** @type {boolean} Connection status */
    let connected = false;

    /** @type {string|null} Current room code */
    let roomCode = null;

    /** @type {number|null} Player ID in current room */
    let playerId = null;

    /** @type {Function|null} Message handler */
    let onMessage = null;

    /** @type {Function|null} Connection status change handler */
    let onStatusChange = null;

    /** @type {number} Reconnect attempt counter */
    let reconnectAttempts = 0;

    /** @type {number|null} Reconnect timeout */
    let reconnectTimeout = null;

    /** @constant {number} Max reconnect delay (ms) */
    const MAX_RECONNECT_DELAY = 30000;

    /**
     * Sets callback handlers
     * @param {Object} callbacks
     * @param {Function} callbacks.onMessage - Message handler
     * @param {Function} callbacks.onStatusChange - Status change handler
     */
    function setCallbacks(callbacks) {
        onMessage = callbacks.onMessage || null;
        onStatusChange = callbacks.onStatusChange || null;
    }

    /**
     * Connects to the WebSocket server
     * @param {string} [url] - Server URL (auto-detected if not provided)
     * @returns {Promise<boolean>} Connection success
     */
    function connect(url) {
        return new Promise((resolve) => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                resolve(true);
                return;
            }

            const wsUrl = url || `ws://${window.location.host}`;
            console.log(`[INFO] WebSocket bağlanıyor: ${wsUrl}`);

            try {
                ws = new WebSocket(wsUrl);
            } catch (error) {
                console.error('[ERROR] WebSocket oluşturulamadı:', error);
                resolve(false);
                return;
            }

            ws.onopen = () => {
                connected = true;
                reconnectAttempts = 0;
                console.log('[INFO] WebSocket bağlandı');
                if (onStatusChange) onStatusChange('connected');
                resolve(true);
            };

            ws.onclose = () => {
                connected = false;
                console.log('[INFO] WebSocket bağlantısı kapandı');
                if (onStatusChange) onStatusChange('disconnected');
                attemptReconnect();
            };

            ws.onerror = (error) => {
                console.error('[ERROR] WebSocket hatası:', error);
                if (onStatusChange) onStatusChange('error');
                resolve(false);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    handleIncomingMessage(data);
                } catch (error) {
                    console.error('[ERROR] Mesaj parse hatası:', error);
                }
            };
        });
    }

    /**
     * Attempts to reconnect with exponential backoff
     */
    function attemptReconnect() {
        if (reconnectTimeout) return;

        reconnectAttempts++;
        const delay = Math.min(
            Math.pow(2, reconnectAttempts) * 1000,
            MAX_RECONNECT_DELAY
        );

        console.log(`[INFO] Yeniden bağlanma denemesi ${reconnectAttempts}, ${delay}ms sonra...`);
        reconnectTimeout = setTimeout(() => {
            reconnectTimeout = null;
            connect();
        }, delay);
    }

    /**
     * Handles incoming WebSocket messages
     * @param {Object} data - Parsed message object
     */
    function handleIncomingMessage(data) {
        // Update local state
        switch (data.type) {
            case 'ROOM_CREATED':
                roomCode = data.roomCode;
                playerId = data.playerId;
                break;
            case 'ROOM_JOINED':
                roomCode = data.roomCode;
                playerId = data.playerId;
                break;
        }

        // Forward to handler
        if (onMessage) {
            onMessage(data);
        }
    }

    /**
     * Sends a message to the server
     * @param {Object} data - Message object
     */
    function send(data) {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            console.error('[ERROR] WebSocket bağlı değil, mesaj gönderilemez');
            return;
        }
        ws.send(JSON.stringify(data));
    }

    /**
     * Creates a new room
     * @param {string} playerName
     */
    function createRoom(playerName) {
        send({ type: 'CREATE_ROOM', playerName });
    }

    /**
     * Joins an existing room
     * @param {string} code - Room code
     * @param {string} playerName
     */
    function joinRoom(code, playerName) {
        send({ type: 'JOIN_ROOM', roomCode: code, playerName });
    }

    /**
     * Selects a field (host only)
     * @param {string} fieldId
     */
    function selectField(fieldId) {
        send({ type: 'SELECT_FIELD', fieldId });
    }

    /**
     * Confirms field selection
     */
    function confirmField() {
        send({ type: 'CONFIRM_FIELD' });
    }

    /**
     * Sends a shot command
     * @param {number} angle
     * @param {number} power
     */
    function shoot(angle, power) {
        send({ type: 'SHOOT', angle, power });
    }

    /**
     * Sends ready signal
     */
    function ready() {
        send({ type: 'READY' });
    }

    /**
     * Disconnects from the server
     */
    function disconnect() {
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
        }
        reconnectAttempts = 0;
        if (ws) {
            ws.onclose = null; // Prevent reconnect
            ws.close();
            ws = null;
        }
        connected = false;
        roomCode = null;
        playerId = null;
    }

    /**
     * @returns {boolean} Whether connected
     */
    function isConnected() {
        return connected;
    }

    /**
     * @returns {string|null} Current room code
     */
    function getRoomCode() {
        return roomCode;
    }

    /**
     * @returns {number|null} Current player ID
     */
    function getPlayerId() {
        return playerId;
    }

    return {
        setCallbacks,
        connect,
        send,
        createRoom,
        joinRoom,
        selectField,
        confirmField,
        shoot,
        ready,
        disconnect,
        isConnected,
        getRoomCode,
        getPlayerId
    };
})();
