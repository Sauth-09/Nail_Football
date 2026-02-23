/**
 * leaderboardService.js - Skor Tablosu Hesaplama ve Cache
 * 
 * Haftalık, aylık ve tüm zamanlar skor tablolarını hesaplar.
 * 5 dakikalık cache süresi vardır.
 */

'use strict';

const Match = require('../models/Match');
const Player = require('../models/Player');
const LeaderboardCache = require('../models/LeaderboardCache');
const { isDBConnected } = require('../db');

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 dakika

/**
 * Haftanın başlangıcını bul (Pazartesi 00:00 UTC)
 */
function getWeekStart(date = new Date()) {
    const d = new Date(date);
    const day = d.getUTCDay();
    const diff = day === 0 ? 6 : day - 1; // Pazartesi = 0
    d.setUTCDate(d.getUTCDate() - diff);
    d.setUTCHours(0, 0, 0, 0);
    return d;
}

/**
 * Ayın başlangıcını bul
 */
function getMonthStart(date = new Date()) {
    const d = new Date(date);
    d.setUTCDate(1);
    d.setUTCHours(0, 0, 0, 0);
    return d;
}

/**
 * Haftanın sonunu bul (Pazar 23:59 UTC)
 */
function getWeekEnd(date = new Date()) {
    const start = getWeekStart(date);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    end.setUTCHours(23, 59, 59, 999);
    return end;
}

/**
 * Ayın sonunu bul
 */
function getMonthEnd(date = new Date()) {
    const d = new Date(date);
    d.setUTCMonth(d.getUTCMonth() + 1, 0);
    d.setUTCHours(23, 59, 59, 999);
    return d;
}

/**
 * Skor tablosu hesapla
 * @param {string} type - 'weekly', 'monthly', 'alltime'
 * @returns {Object} { entries, periodStart, periodEnd }
 */
async function calculateLeaderboard(type) {
    if (!isDBConnected()) return { entries: [] };

    let periodStart, periodEnd;
    let minMatches;

    if (type === 'weekly') {
        periodStart = getWeekStart();
        periodEnd = getWeekEnd();
        minMatches = 3;
    } else if (type === 'monthly') {
        periodStart = getMonthStart();
        periodEnd = getMonthEnd();
        minMatches = 5;
    } else {
        periodStart = new Date(0);
        periodEnd = new Date();
        minMatches = 1;
    }

    // İlgili zaman aralığındaki maçları çek
    const matches = await Match.find({
        playedAt: { $gte: periodStart, $lte: periodEnd }
    }).lean();

    // Her oyuncu için istatistikleri topla
    const playerStats = {};

    for (const match of matches) {
        const p1 = match.player1.username;
        const p2 = match.player2.username;

        if (!playerStats[p1]) playerStats[p1] = { wins: 0, losses: 0, draws: 0, goalsScored: 0, goalsConceded: 0, matchesPlayed: 0 };
        if (!playerStats[p2]) playerStats[p2] = { wins: 0, losses: 0, draws: 0, goalsScored: 0, goalsConceded: 0, matchesPlayed: 0 };

        playerStats[p1].matchesPlayed++;
        playerStats[p2].matchesPlayed++;
        playerStats[p1].goalsScored += match.player1.score;
        playerStats[p1].goalsConceded += match.player2.score;
        playerStats[p2].goalsScored += match.player2.score;
        playerStats[p2].goalsConceded += match.player1.score;

        if (!match.winner) {
            playerStats[p1].draws++;
            playerStats[p2].draws++;
        } else if (match.winner === p1) {
            playerStats[p1].wins++;
            playerStats[p2].losses++;
        } else {
            playerStats[p2].wins++;
            playerStats[p1].losses++;
        }
    }

    // Rating bilgisini ekle
    const players = await Player.find({
        username: { $in: Object.keys(playerStats) }
    }).lean();

    const ratingMap = {};
    for (const p of players) ratingMap[p.username] = p.rating;

    // Sıralama oluştur
    const entries = Object.entries(playerStats)
        .filter(([_, s]) => s.matchesPlayed >= minMatches)
        .map(([username, s]) => ({
            username,
            wins: s.wins,
            losses: s.losses,
            draws: s.draws,
            goalsScored: s.goalsScored,
            goalsConceded: s.goalsConceded,
            goalDifference: s.goalsScored - s.goalsConceded,
            matchesPlayed: s.matchesPlayed,
            points: (s.wins * 3) + (s.draws * 1),
            rating: ratingMap[username] || 1000,
            winRate: s.matchesPlayed > 0 ? Math.round((s.wins / s.matchesPlayed) * 100) : 0
        }))
        .sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
            if (b.goalsScored !== a.goalsScored) return b.goalsScored - a.goalsScored;
            return b.winRate - a.winRate;
        });

    // Sıralama numarası ata
    entries.forEach((e, i) => { e.rank = i + 1; });

    // Cache'e kaydet
    await LeaderboardCache.findOneAndUpdate(
        { type, periodStart },
        { type, periodStart, periodEnd, entries, generatedAt: new Date() },
        { upsert: true, new: true }
    );

    return { entries, periodStart, periodEnd };
}

/**
 * Cache'den skor tablosu getir (5dk cache)
 * @param {string} type
 */
async function getLeaderboard(type) {
    if (!isDBConnected()) return { entries: [] };

    let periodStart;
    if (type === 'weekly') periodStart = getWeekStart();
    else if (type === 'monthly') periodStart = getMonthStart();
    else periodStart = new Date(0);

    const cached = await LeaderboardCache.findOne({ type, periodStart }).lean();

    if (cached && (Date.now() - cached.generatedAt.getTime()) < CACHE_DURATION_MS) {
        return { entries: cached.entries, periodStart: cached.periodStart, periodEnd: cached.periodEnd, cached: true };
    }

    return calculateLeaderboard(type);
}

module.exports = { getLeaderboard, calculateLeaderboard };
