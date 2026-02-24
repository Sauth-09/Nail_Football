/**
 * playerService.js - Oyuncu İşlemleri ve Elo Hesaplama
 */

'use strict';

const Player = require('../models/Player');
const { isDBConnected } = require('../db');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

/**
 * Yeni oyuncu kaydı
 * @param {string} username
 * @param {string} password
 * @returns {Object} { player, token }
 * @throws {Error} if DB is not connected or username is taken
 */
async function registerPlayer(username, password) {
    if (!isDBConnected()) throw new Error('NO_DB_CONNECTION');

    const existing = await Player.findOne({ username });
    if (existing) throw new Error('USERNAME_TAKEN');

    const token = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);
    const player = await Player.create({ username, passwordHash, token });
    console.log(`[PLAYER] Yeni oyuncu kaydı: ${username} #${player.memberCode}`);
    return { player, token };
}

/**
 * Kullanıcı adı ve şifre ile giriş
 * @param {string} username
 * @param {string} password
 * @returns {Object|null} player
 */
async function loginByPassword(username, password) {
    if (!isDBConnected()) return null;

    const player = await Player.findOne({ username });
    if (!player) return null;

    if (!player.passwordHash) {
        // Eski hesap, şifresi yok. İlk girilen şifreyi bu hesaba kaydet.
        player.passwordHash = await bcrypt.hash(password, 10);
        player.lastActive = new Date();
        await player.save();
        console.log(`[PLAYER] Eski hesaba şifre tanımlandı: ${username}`);
        return { player, token: player.token };
    }

    const isMatch = await bcrypt.compare(password, player.passwordHash);
    if (!isMatch) return null;

    player.lastActive = new Date();
    await player.save();
    return { player, token: player.token };
}

/**
 * Token ile giriş
 * @param {string} token
 * @returns {Object|null} player
 */
async function loginByToken(token) {
    if (!isDBConnected()) return null;
    const player = await Player.findOne({ token });
    if (player) {
        player.lastActive = new Date();
        await player.save();
    }
    return player;
}

/**
 * Oyuncu profili getir
 * @param {string} username
 * @returns {Object|null}
 */
async function getPlayer(username) {
    if (!isDBConnected()) return null;
    return Player.findOne({ username });
}

/**
 * Üye kodu ile oyuncu ara
 * @param {string} memberCode
 * @returns {Object|null}
 */
async function findByMemberCode(memberCode) {
    if (!isDBConnected()) return null;
    return Player.findOne({ memberCode: memberCode.toLowerCase().trim() });
}

/**
 * Elo rating hesapla ve güncelle
 * K-faktör: 32, minimum: 100
 * @param {string} winnerUsername
 * @param {string} loserUsername
 * @param {boolean} isDraw
 */
async function updateElo(winnerUsername, loserUsername, isDraw = false) {
    if (!isDBConnected()) return;

    const playerA = await Player.findOne({ username: winnerUsername });
    const playerB = await Player.findOne({ username: loserUsername });
    if (!playerA || !playerB) return;

    const K = 32;
    const EA = 1 / (1 + Math.pow(10, (playerB.rating - playerA.rating) / 400));
    const EB = 1 / (1 + Math.pow(10, (playerA.rating - playerB.rating) / 400));

    const SA = isDraw ? 0.5 : 1;
    const SB = isDraw ? 0.5 : 0;

    playerA.rating = Math.max(100, Math.round(playerA.rating + K * (SA - EA)));
    playerB.rating = Math.max(100, Math.round(playerB.rating + K * (SB - EB)));

    await playerA.save();
    await playerB.save();

    console.log(`[ELO] ${winnerUsername}: ${playerA.rating}, ${loserUsername}: ${playerB.rating}`);
    return {
        [winnerUsername]: { rating: playerA.rating, change: Math.round(K * (SA - EA)) },
        [loserUsername]: { rating: playerB.rating, change: Math.round(K * (SB - EB)) }
    };
}

/**
 * Maç sonrası oyuncu istatistiklerini güncelle
 * @param {string} username
 * @param {Object} result - { won, draw, goalsScored, goalsConceded }
 */
async function updateStats(username, result) {
    if (!isDBConnected()) return;

    const player = await Player.findOne({ username });
    if (!player) return;

    player.stats.totalMatches++;
    player.stats.goalsScored += result.goalsScored || 0;
    player.stats.goalsConceded += result.goalsConceded || 0;

    if (result.draw) {
        player.stats.draws++;
        player.stats.winStreak = 0;
    } else if (result.won) {
        player.stats.wins++;
        player.stats.winStreak++;
        if (player.stats.winStreak > player.stats.bestWinStreak) {
            player.stats.bestWinStreak = player.stats.winStreak;
        }
    } else {
        player.stats.losses++;
        player.stats.winStreak = 0;
    }

    player.lastActive = new Date();
    await player.save();
}

/**
 * Oyuncunun son maçlarını getir
 * @param {string} username
 * @param {number} limit
 */
async function getRecentMatches(username, limit = 5) {
    if (!isDBConnected()) return [];
    const Match = require('../models/Match');
    return Match.find({
        $or: [
            { 'player1.username': username },
            { 'player2.username': username }
        ]
    }).sort({ playedAt: -1 }).limit(limit).lean();
}

/**
 * Mevcut oyunculara memberCode ataması (migration)
 */
async function runMigrations() {
    if (!isDBConnected()) return;
    try {
        const count = await Player.migrateMemberCodes();
        if (count > 0) {
            console.log(`[MIGRATION] Toplam ${count} oyuncuya üye kodu atandı.`);
        }
    } catch (err) {
        console.error('[MIGRATION] Üye kodu migration hatası:', err.message);
    }
}

module.exports = {
    registerPlayer,
    loginByPassword,
    loginByToken,
    getPlayer,
    findByMemberCode,
    updateElo,
    updateStats,
    getRecentMatches,
    runMigrations
};
