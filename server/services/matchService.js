/**
 * matchService.js - Maç Kayıt ve İstatistik Güncelleme
 */

'use strict';

const Match = require('../models/Match');
const playerService = require('./playerService');
const { isDBConnected } = require('../db');

/**
 * Maç sonucunu kaydet ve istatistikleri güncelle
 * @param {Object} data - { player1: {username, score}, player2: {username, score}, fieldId, goalLimit, duration, totalShots, tournamentId, tournamentRound }
 * @returns {Object} { match, eloChanges }
 */
async function recordMatch(data) {
    if (!isDBConnected()) return null;

    const { player1, player2 } = data;
    const isDraw = player1.score === player2.score;
    const winner = isDraw ? null : (player1.score > player2.score ? player1.username : player2.username);

    // Maç kaydı oluştur
    const match = await Match.create({
        player1,
        player2,
        winner,
        fieldId: data.fieldId,
        goalLimit: data.goalLimit,
        duration: data.duration,
        totalShots: data.totalShots,
        tournamentId: data.tournamentId || null,
        tournamentRound: data.tournamentRound || null
    });

    // Oyuncu istatistiklerini güncelle
    const p1Won = winner === player1.username;
    const p2Won = winner === player2.username;

    await playerService.updateStats(player1.username, {
        won: p1Won,
        draw: isDraw,
        goalsScored: player1.score,
        goalsConceded: player2.score
    });

    await playerService.updateStats(player2.username, {
        won: p2Won,
        draw: isDraw,
        goalsScored: player2.score,
        goalsConceded: player1.score
    });

    // Elo hesapla
    let eloChanges = null;
    if (!isDraw) {
        const loser = winner === player1.username ? player2.username : player1.username;
        eloChanges = await playerService.updateElo(winner, loser, false);
    } else {
        eloChanges = await playerService.updateElo(player1.username, player2.username, true);
    }

    console.log(`[MATCH] Maç kaydedildi: ${player1.username} ${player1.score}-${player2.score} ${player2.username}`);

    return { match, eloChanges };
}

module.exports = { recordMatch };
