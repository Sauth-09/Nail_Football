/**
 * spectatorService.js - Spectator Mode Service
 * 
 * Manages spectators for active multiplayer matches.
 * Provides functions to list active matches, add/remove
 * spectators, and broadcast game updates to spectators.
 */

'use strict';

class SpectatorService {
    constructor() {
        /** @type {Map<string, Set<WebSocket>>} Room code -> Set of spectator WebSockets */
        this.spectators = new Map();
    }

    /**
     * Gets list of active matches available for spectating
     * @param {Object} gameManager - GameManager instance
     * @returns {Array<Object>} Active match list
     */
    getActiveMatches(gameManager) {
        const matches = [];
        for (const [roomCode, room] of gameManager.rooms) {
            // Only show rooms that are actively playing (have 2 players and game started)
            if (room.players && room.players.length === 2 && room.gameStarted) {
                const spectatorCount = this.spectators.has(roomCode)
                    ? this.spectators.get(roomCode).size
                    : 0;

                matches.push({
                    roomCode: roomCode,
                    player1: room.players[0]?.name || 'Oyuncu 1',
                    player2: room.players[1]?.name || 'Oyuncu 2',
                    score: room.score || { p1: 0, p2: 0 },
                    fieldId: room.fieldId || 'classic',
                    spectators: spectatorCount,
                    startTime: room.startTime || Date.now()
                });
            }
        }
        return matches;
    }

    /**
     * Adds a spectator to a room
     * @param {string} roomCode - Room to spectate
     * @param {WebSocket} ws - Spectator's WebSocket
     * @param {Object} gameManager - GameManager instance
     * @returns {Object} Result with success/error
     */
    addSpectator(roomCode, ws, gameManager) {
        const room = gameManager.rooms.get(roomCode);
        if (!room) {
            return { error: 'Maç bulunamadı veya artık aktif değil.' };
        }

        if (!room.gameStarted) {
            return { error: 'Maç henüz başlamadı.' };
        }

        // Get or create spectator set for this room
        if (!this.spectators.has(roomCode)) {
            this.spectators.set(roomCode, new Set());
        }

        const spectatorSet = this.spectators.get(roomCode);

        // Limit spectators per room
        if (spectatorSet.size >= 20) {
            return { error: 'Bu maçta seyirci kapasitesi dolu (max 20).' };
        }

        spectatorSet.add(ws);
        ws.spectatingRoom = roomCode;

        // Send current game state to the new spectator
        const gameState = this._buildGameState(room);

        return {
            success: true,
            roomCode: roomCode,
            gameState: gameState,
            spectatorCount: spectatorSet.size
        };
    }

    /**
     * Removes a spectator from a room
     * @param {string} roomCode - Room code
     * @param {WebSocket} ws - Spectator's WebSocket
     */
    removeSpectator(roomCode, ws) {
        const spectatorSet = this.spectators.get(roomCode);
        if (spectatorSet) {
            spectatorSet.delete(ws);
            if (spectatorSet.size === 0) {
                this.spectators.delete(roomCode);
            }
        }
        delete ws.spectatingRoom;
    }

    /**
     * Handles spectator disconnect (cleanup)
     * @param {WebSocket} ws
     */
    handleDisconnect(ws) {
        if (ws.spectatingRoom) {
            this.removeSpectator(ws.spectatingRoom, ws);
        }
    }

    /**
     * Broadcasts data to all spectators of a room
     * @param {string} roomCode - Room code
     * @param {Object} data - Data to broadcast
     */
    broadcastToSpectators(roomCode, data) {
        const spectatorSet = this.spectators.get(roomCode);
        if (!spectatorSet || spectatorSet.size === 0) return;

        const message = JSON.stringify(data);
        for (const ws of spectatorSet) {
            try {
                if (ws.readyState === 1) { // WebSocket.OPEN
                    ws.send(message);
                } else {
                    spectatorSet.delete(ws);
                }
            } catch (err) {
                spectatorSet.delete(ws);
            }
        }
    }

    /**
     * Cleans up spectators when a room is closed
     * @param {string} roomCode
     */
    cleanupRoom(roomCode) {
        const spectatorSet = this.spectators.get(roomCode);
        if (spectatorSet) {
            // Notify spectators that the match ended
            const message = JSON.stringify({
                type: 'SPECTATE_MATCH_ENDED',
                roomCode: roomCode
            });
            for (const ws of spectatorSet) {
                try {
                    if (ws.readyState === 1) {
                        ws.send(message);
                    }
                    delete ws.spectatingRoom;
                } catch (err) { /* silent */ }
            }
            this.spectators.delete(roomCode);
        }
    }

    /**
     * Builds current game state snapshot for a new spectator
     * @param {Object} room - Room object
     * @returns {Object} Game state
     * @private
     */
    _buildGameState(room) {
        return {
            player1: room.players[0]?.name || 'Oyuncu 1',
            player2: room.players[1]?.name || 'Oyuncu 2',
            score: room.score || { p1: 0, p2: 0 },
            fieldId: room.fieldId || 'classic',
            currentPlayer: room.currentPlayer || 1,
            ballPosition: room.ballPosition || null,
            settings: room.settings || {}
        };
    }

    /**
     * Gets spectator count for a room
     * @param {string} roomCode
     * @returns {number}
     */
    getSpectatorCount(roomCode) {
        const spectatorSet = this.spectators.get(roomCode);
        return spectatorSet ? spectatorSet.size : 0;
    }
}

module.exports = SpectatorService;
