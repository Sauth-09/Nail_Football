/**
 * gameManager.js - Oyun Oda Yönetimi
 * 
 * Multiplayer mod için oda oluşturma, katılma ve oyun durumu yönetimi.
 * Her oda benzersiz 4 karakterlik koda sahiptir.
 * Oyuncu bağlantı kopması ve oda zaman aşımı yönetimi dahildir.
 */

'use strict';

const { simulateShot, validateShot } = require('./physicsEngine');
const { getFieldById, getAllFields } = require('./fieldConfigs');

/** @constant {number} Room timeout in ms (5 minutes) */
const ROOM_TIMEOUT = 5 * 60 * 1000;

/** @constant {number} Reconnect timeout in ms (30 seconds) */
const RECONNECT_TIMEOUT = 30 * 1000;

/** @constant {string} Characters for room code generation (numbers only) */
const CODE_CHARS = '0123456789';

/**
 * @typedef {Object} Player
 * @property {WebSocket} ws - WebSocket connection
 * @property {string} name - Player name
 * @property {number} id - Player ID (1 or 2)
 * @property {boolean} connected - Connection status
 * @property {number|null} disconnectTimer - Reconnect timer ID
 */

/**
 * @typedef {Object} Room
 * @property {string} code - Room code
 * @property {Player[]} players - Players in the room
 * @property {string} state - Room state: 'waiting', 'field_select', 'playing', 'finished'
 * @property {Object|null} fieldConfig - Selected field configuration
 * @property {Object} gameState - Current game state
 * @property {number|null} timeoutTimer - Room timeout timer ID
 */

class GameManager {
    constructor() {
        /** @type {Map<string, Room>} */
        this.rooms = new Map();
    }

    /**
     * Generates a unique 4-character room code
     * @returns {string} Room code
     */
    generateRoomCode() {
        let code;
        do {
            code = '';
            for (let i = 0; i < 4; i++) {
                code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
            }
        } while (this.rooms.has(code));
        return code;
    }

    /**
     * Creates a new room
     * @param {WebSocket} ws - Host player's WebSocket
     * @param {string} playerName - Host player's name
     * @returns {Object} Room creation result
     */
    createRoom(ws, playerName) {
        const code = this.generateRoomCode();
        const room = {
            code,
            players: [
                {
                    ws,
                    name: playerName || 'Oyuncu 1',
                    id: 1,
                    connected: true,
                    disconnectTimer: null
                }
            ],
            state: 'waiting',
            fieldConfig: null,
            gameState: {
                scores: [0, 0],
                currentPlayer: 1,
                ballPosition: null
            },
            timeoutTimer: setTimeout(() => this.removeRoom(code), ROOM_TIMEOUT),
            createdAt: Date.now()
        };

        this.rooms.set(code, room);
        console.log(`[INFO] Oda oluşturuldu: ${code} - ${playerName}`);

        return {
            type: 'ROOM_CREATED',
            roomCode: code,
            playerId: 1
        };
    }

    /**
     * Joins an existing room
     * @param {WebSocket} ws - Joining player's WebSocket
     * @param {string} roomCode - Room code to join
     * @param {string} playerName - Player name
     * @returns {Object} Join result
     */
    joinRoom(ws, roomCode, playerName) {
        const room = this.rooms.get(roomCode.toUpperCase());

        if (!room) {
            return { type: 'ERROR', message: 'Oda bulunamadı!' };
        }

        if (room.state !== 'waiting') {
            return { type: 'ERROR', message: 'Oda dolu veya oyun başlamış!' };
        }

        if (room.players.length >= 2) {
            return { type: 'ERROR', message: 'Oda dolu!' };
        }

        // Clear timeout since second player joined
        if (room.timeoutTimer) {
            clearTimeout(room.timeoutTimer);
            room.timeoutTimer = null;
        }

        const player = {
            ws,
            name: playerName || 'Oyuncu 2',
            id: 2,
            connected: true,
            disconnectTimer: null
        };

        room.players.push(player);
        room.state = 'field_select';

        console.log(`[INFO] Oyuncu katıldı: ${roomCode} - ${playerName}`);

        // Notify host
        this.sendToPlayer(room, 1, {
            type: 'PLAYER_JOINED',
            playerName: player.name,
            playerId: 2
        });

        // Send field list to both players
        const fields = getAllFields();
        this.broadcastToRoom(room, {
            type: 'FIELD_LIST',
            fields
        });

        return {
            type: 'ROOM_JOINED',
            roomCode: room.code,
            playerId: 2,
            hostName: room.players[0].name
        };
    }

    /**
     * Handles field selection by host
     * @param {string} roomCode - Room code
     * @param {string} fieldId - Selected field ID
     * @returns {Object|null} Result
     */
    selectField(roomCode, fieldId) {
        const room = this.rooms.get(roomCode);
        if (!room || room.state !== 'field_select') return null;

        const fieldConfig = getFieldById(fieldId);
        if (!fieldConfig) {
            return { type: 'ERROR', message: 'Geçersiz saha!' };
        }

        room.fieldConfig = fieldConfig;

        // Notify all players
        this.broadcastToRoom(room, {
            type: 'FIELD_SELECTED',
            fieldId,
            fieldData: fieldConfig
        });

        return { type: 'FIELD_SELECTED', fieldId };
    }

    /**
     * Confirms field selection and starts game
     * @param {string} roomCode - Room code
     * @param {Object} [settings] - Room settings
     * @returns {Object|null} Game start data
     */
    confirmField(roomCode, settings) {
        const room = this.rooms.get(roomCode);
        if (!room || !room.fieldConfig) return null;

        // Apply custom host settings to the room's simulation
        if (settings) {
            if (settings.friction) {
                room.fieldConfig.friction = settings.friction;
                console.log(`[INFO] Oda ${roomCode} friction ayarlandı: ${settings.friction}`);
            }
            if (settings.goalLimit !== undefined) {
                room.settings.goalLimit = settings.goalLimit;
            }
        }

        room.state = 'playing';
        room.gameState = {
            scores: [0, 0],
            currentPlayer: 1,
            ballPosition: { ...room.fieldConfig.ballStartPosition }
        };

        const startData = {
            type: 'GAME_START',
            initialState: {
                ballPosition: { ...room.fieldConfig.ballStartPosition },
                scores: [0, 0],
                currentPlayer: 1
            }
        };

        this.broadcastToRoom(room, startData);
        console.log(`[INFO] Oyun başladı: ${roomCode}`);
        return startData;
    }

    /**
     * Processes a shot in multiplayer mode
     * @param {string} roomCode - Room code
     * @param {number} playerId - Shooting player ID
     * @param {number} angle - Shot angle in radians
     * @param {number} power - Shot power (0-1)
     * @returns {Object|null} Shot result
     */
    processShot(roomCode, playerId, angle, power) {
        const room = this.rooms.get(roomCode);
        if (!room || room.state !== 'playing') return null;
        if (room.gameState.currentPlayer !== playerId) return null;
        if (!validateShot(angle, power)) return null;

        // Run physics simulation on server
        const result = simulateShot(
            room.fieldConfig,
            angle,
            power,
            room.gameState.ballPosition
        );

        // Update game state
        room.gameState.ballPosition = result.finalPosition;

        // Check for goal
        if (result.goalScored) {
            // P1 defends LEFT goal, P2 defends RIGHT goal
            // Left goal = P2 scored (into P1's goal), Right goal = P1 scored (into P2's goal)
            const scoringPlayer = result.goalScored.side === 'left' ? 2 : 1;
            room.gameState.scores[scoringPlayer - 1]++;

            // Reset ball to center
            room.gameState.ballPosition = { ...room.fieldConfig.ballStartPosition };

            // Switch turns: scored-upon player kicks off
            room.gameState.currentPlayer = room.gameState.currentPlayer === 1 ? 2 : 1;

            // Broadcast shot, goal, and turn change
            this.broadcastToRoom(room, {
                type: 'SHOT_EXECUTED',
                angle,
                power,
                trajectory: result.trajectory
            });

            this.broadcastToRoom(room, {
                type: 'GOAL_SCORED',
                scoringPlayer,
                scores: [...room.gameState.scores]
            });

            this.broadcastToRoom(room, {
                type: 'TURN_CHANGE',
                currentPlayer: room.gameState.currentPlayer,
                ballPosition: { ...room.gameState.ballPosition }
            });

            // Check game over conditions
            // (handled by client based on settings)

            console.log(`[INFO] Gol! Oda: ${roomCode}, Oyuncu: ${scoringPlayer}, Skor: ${room.gameState.scores}`);
        } else {
            // Switch turns
            room.gameState.currentPlayer = room.gameState.currentPlayer === 1 ? 2 : 1;

            this.broadcastToRoom(room, {
                type: 'SHOT_EXECUTED',
                angle,
                power,
                trajectory: result.trajectory
            });

            this.broadcastToRoom(room, {
                type: 'TURN_CHANGE',
                currentPlayer: room.gameState.currentPlayer,
                ballPosition: { ...room.gameState.ballPosition }
            });
        }

        return result;
    }

    /**
     * Handles player disconnection
     * @param {WebSocket} ws - Disconnected player's WebSocket
     */
    handleDisconnect(ws) {
        for (const [code, room] of this.rooms) {
            const player = room.players.find(p => p.ws === ws);
            if (!player) continue;

            player.connected = false;
            console.log(`[INFO] Oyuncu bağlantısı koptu: Oda ${code}, Oyuncu ${player.id}`);

            // Notify other player
            const otherPlayer = room.players.find(p => p.id !== player.id);
            if (otherPlayer && otherPlayer.connected) {
                this.sendToPlayer(room, otherPlayer.id, {
                    type: 'PLAYER_DISCONNECTED',
                    playerId: player.id,
                    timeout: RECONNECT_TIMEOUT
                });
            }

            // Set reconnect timer
            player.disconnectTimer = setTimeout(() => {
                console.log(`[INFO] Oyuncu yeniden bağlanamadı, oda siliniyor: ${code}`);
                this.broadcastToRoom(room, {
                    type: 'GAME_CANCELLED',
                    reason: 'Oyuncu bağlantısı koptu'
                });
                this.removeRoom(code);
            }, RECONNECT_TIMEOUT);

            break;
        }
    }

    /**
     * Sends a message to a specific player in a room
     * @param {Room} room - Room object
     * @param {number} playerId - Target player ID
     * @param {Object} data - Message data
     */
    sendToPlayer(room, playerId, data) {
        const player = room.players.find(p => p.id === playerId);
        if (player && player.connected && player.ws.readyState === 1) {
            try {
                player.ws.send(JSON.stringify(data));
            } catch (error) {
                console.error(`[ERROR] Mesaj gönderme hatası: ${error.message}`);
            }
        }
    }

    /**
     * Broadcasts a message to all players in a room
     * @param {Room} room - Room object
     * @param {Object} data - Message data
     */
    broadcastToRoom(room, data) {
        const message = JSON.stringify(data);
        for (const player of room.players) {
            if (player.connected && player.ws.readyState === 1) {
                try {
                    player.ws.send(message);
                } catch (error) {
                    console.error(`[ERROR] Broadcast hatası: ${error.message}`);
                }
            }
        }
    }

    /**
     * Removes a room and cleans up timers
     * @param {string} code - Room code
     */
    removeRoom(code) {
        const room = this.rooms.get(code);
        if (!room) return;

        if (room.timeoutTimer) clearTimeout(room.timeoutTimer);
        for (const player of room.players) {
            if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
        }

        this.rooms.delete(code);
        console.log(`[INFO] Oda silindi: ${code}`);
    }

    /**
     * Finds the room code for a given WebSocket
     * @param {WebSocket} ws - WebSocket connection
     * @returns {string|null} Room code or null
     */
    findRoomByWs(ws) {
        for (const [code, room] of this.rooms) {
            if (room.players.some(p => p.ws === ws)) {
                return code;
            }
        }
        return null;
    }

    /**
     * Gets the player ID for a WebSocket in a room
     * @param {string} roomCode - Room code
     * @param {WebSocket} ws - WebSocket connection
     * @returns {number|null} Player ID or null
     */
    getPlayerId(roomCode, ws) {
        const room = this.rooms.get(roomCode);
        if (!room) return null;
        const player = room.players.find(p => p.ws === ws);
        return player ? player.id : null;
    }

    /**
     * Gets current server stats
     * @returns {Object} Stats object
     */
    getStats() {
        let players = 0;
        for (const room of this.rooms.values()) {
            players += room.players.filter(p => p.connected).length;
        }
        return {
            players,
            rooms: this.rooms.size
        };
    }

    /**
     * Cleans up empty rooms (no connected players)
     */
    clearEmptyRooms() {
        for (const [code, room] of this.rooms.entries()) {
            const hasConnectedPlayers = room.players.some(p => p.connected);
            if (!hasConnectedPlayers) {
                console.log(`[INFO] Bos oda otomatik silindi: ${code}`);
                this.removeRoom(code);
            }
        }
    }
}

module.exports = GameManager;
