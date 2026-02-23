/**
 * tournamentService.js - Turnuva İşlemleri
 * 
 * Turnuva CRUD, bracket oluşturma (seeding),
 * tur ilerletme ve sonuçlandırma.
 * MVP: Sadece Tek Elemeli (Single Elimination).
 */

'use strict';

const Tournament = require('../models/Tournament');
const { isDBConnected } = require('../db');

// Tur isimleri
const ROUND_NAMES = {
    1: 'İlk Tur',
    2: 'Çeyrek Final',
    3: 'Yarı Final',
    4: 'Final'
};

function getRoundName(roundNumber, totalRounds) {
    const fromFinal = totalRounds - roundNumber;
    if (fromFinal === 0) return 'Final';
    if (fromFinal === 1) return 'Yarı Final';
    if (fromFinal === 2) return 'Çeyrek Final';
    return `${roundNumber}. Tur`;
}

/**
 * Turnuva oluştur
 */
async function createTournament(data) {
    if (!isDBConnected()) return null;

    const tournament = await Tournament.create({
        name: data.name,
        createdBy: data.createdBy,
        settings: {
            format: 'single_elimination',
            maxPlayers: data.maxPlayers || 8,
            goalLimit: data.goalLimit || 5,
            fieldId: data.fieldId || 'classic_442',
            seedByRating: true
        },
        participants: [{
            username: data.createdBy,
            seed: null,
            eliminated: false
        }]
    });

    console.log(`[TOURNAMENT] Oluşturuldu: ${data.name} (${data.maxPlayers} kişi)`);
    return tournament;
}

/**
 * Turnuvaya katıl
 */
async function joinTournament(tournamentId, username) {
    if (!isDBConnected()) return { error: 'DB bağlı değil' };

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) return { error: 'Turnuva bulunamadı' };
    if (tournament.status !== 'waiting') return { error: 'Turnuva katılıma kapalı' };
    if (tournament.participants.length >= tournament.settings.maxPlayers) return { error: 'Turnuva dolu' };
    if (tournament.participants.some(p => p.username === username)) return { error: 'Zaten katıldınız' };

    tournament.participants.push({
        username,
        seed: null,
        eliminated: false
    });

    await tournament.save();
    console.log(`[TOURNAMENT] ${username} katıldı: ${tournament.name}`);
    return { tournament };
}

/**
 * Turnuvadan ayrıl
 */
async function leaveTournament(tournamentId, username) {
    if (!isDBConnected()) return { error: 'DB bağlı değil' };

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) return { error: 'Turnuva bulunamadı' };
    if (tournament.status !== 'waiting') return { error: 'Turnuva başladı, ayrılamazsınız' };

    tournament.participants = tournament.participants.filter(p => p.username !== username);
    await tournament.save();
    return { tournament };
}

/**
 * Turnuvayı başlat — Bracket oluştur
 */
async function startTournament(tournamentId, username) {
    if (!isDBConnected()) return { error: 'DB bağlı değil' };

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) return { error: 'Turnuva bulunamadı' };
    if (tournament.createdBy !== username) return { error: 'Sadece oluşturan başlatabilir' };
    if (tournament.status !== 'waiting') return { error: 'Turnuva zaten başladı' };

    const Player = require('../models/Player');
    const players = tournament.participants.map(p => p.username);

    // Elo'ya göre sırala
    if (tournament.settings.seedByRating) {
        const playerDocs = await Player.find({ username: { $in: players } }).lean();
        const ratingMap = {};
        playerDocs.forEach(p => { ratingMap[p.username] = p.rating; });
        players.sort((a, b) => (ratingMap[b] || 1000) - (ratingMap[a] || 1000));
    }

    // Seed ata
    players.forEach((username, i) => {
        const p = tournament.participants.find(p => p.username === username);
        if (p) p.seed = i + 1;
    });

    // Bracket oluştur (tek elemeli)
    const bracket = generateBracket(players);
    tournament.rounds = bracket;
    tournament.status = 'in_progress';
    tournament.startedAt = new Date();

    await tournament.save();
    console.log(`[TOURNAMENT] Başladı: ${tournament.name} (${players.length} oyuncu)`);
    return { tournament };
}

/**
 * Tek elemeli bracket oluştur
 * Seeding: 1v8, 4v5, 2v7, 3v6 (standart)
 */
function generateBracket(players) {
    const n = players.length;

    // Kaç tam güce yuvarla (bye'lar için)
    let bracketSize = 1;
    while (bracketSize < n) bracketSize *= 2;

    // Seeded eşleşme
    const seededOrder = getSeedOrder(bracketSize);
    const matchups = [];
    for (let i = 0; i < seededOrder.length; i += 2) {
        const p1 = seededOrder[i] < n ? players[seededOrder[i]] : null;
        const p2 = seededOrder[i + 1] < n ? players[seededOrder[i + 1]] : null;
        matchups.push([p1, p2]);
    }

    // Kaç tur var
    const totalRounds = Math.log2(bracketSize);
    const rounds = [];

    // İlk tur
    const firstRoundMatches = matchups.map((m, i) => {
        const isBye = !m[0] || !m[1];
        return {
            matchIndex: i,
            player1: m[0],
            player2: m[1],
            score1: 0,
            score2: 0,
            winner: isBye ? (m[0] || m[1]) : null,
            status: isBye ? 'completed' : 'ready'
        };
    });

    rounds.push({
        roundNumber: 1,
        roundName: getRoundName(1, totalRounds),
        matches: firstRoundMatches
    });

    // Sonraki turlar (boş)
    let matchCount = bracketSize / 2;
    for (let r = 2; r <= totalRounds; r++) {
        matchCount = matchCount / 2;
        const rMatches = [];
        for (let i = 0; i < matchCount; i++) {
            rMatches.push({
                matchIndex: i,
                player1: null,
                player2: null,
                score1: 0,
                score2: 0,
                winner: null,
                status: 'pending'
            });
        }
        rounds.push({
            roundNumber: r,
            roundName: getRoundName(r, totalRounds),
            matches: rMatches
        });
    }

    // Bye kazananlarını sonraki tura ilerlet
    advanceByeWinners(rounds);

    return rounds;
}

/**
 * Seeding sırası (standart turnuva seeding)
 */
function getSeedOrder(n) {
    if (n === 1) return [0];
    const half = getSeedOrder(n / 2);
    return half.reduce((result, seed) => {
        result.push(seed);
        result.push(n - 1 - seed);
        return result;
    }, []);
}

/**
 * Bye kazananları bir sonraki tura ilerlet
 */
function advanceByeWinners(rounds) {
    if (rounds.length < 2) return;
    const firstRound = rounds[0];
    const secondRound = rounds[1];

    firstRound.matches.forEach((match, i) => {
        if (match.winner && match.status === 'completed') {
            const nextMatchIdx = Math.floor(i / 2);
            const nextMatch = secondRound.matches[nextMatchIdx];
            if (nextMatch) {
                if (i % 2 === 0) nextMatch.player1 = match.winner;
                else nextMatch.player2 = match.winner;
                // Check if both players are set
                if (nextMatch.player1 && nextMatch.player2) nextMatch.status = 'ready';
            }
        }
    });
}

/**
 * Maç sonucunu turnuvaya işle
 */
async function recordTournamentMatch(tournamentId, roundNumber, matchIndex, winner, score1, score2) {
    if (!isDBConnected()) return { error: 'DB bağlı değil' };

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) return { error: 'Turnuva bulunamadı' };

    const round = tournament.rounds.find(r => r.roundNumber === roundNumber);
    if (!round) return { error: 'Tur bulunamadı' };

    const match = round.matches.find(m => m.matchIndex === matchIndex);
    if (!match) return { error: 'Maç bulunamadı' };

    match.score1 = score1;
    match.score2 = score2;
    match.winner = winner;
    match.status = 'completed';

    // Kaybeden elendi
    const loser = match.player1 === winner ? match.player2 : match.player1;
    const loserP = tournament.participants.find(p => p.username === loser);
    if (loserP) loserP.eliminated = true;

    // Kazananı sonraki tura ilerlet
    const nextRoundIdx = tournament.rounds.findIndex(r => r.roundNumber === roundNumber + 1);
    if (nextRoundIdx !== -1) {
        const nextRound = tournament.rounds[nextRoundIdx];
        const nextMatchIdx = Math.floor(matchIndex / 2);
        const nextMatch = nextRound.matches[nextMatchIdx];
        if (nextMatch) {
            if (matchIndex % 2 === 0) nextMatch.player1 = winner;
            else nextMatch.player2 = winner;
            if (nextMatch.player1 && nextMatch.player2) nextMatch.status = 'ready';
        }
    } else {
        // Bu final maçıydı — turnuva bitti
        tournament.winner = winner;
        tournament.runnerUp = loser;
        tournament.status = 'completed';
        tournament.completedAt = new Date();

        // Oyuncu stats güncelle
        const playerService = require('./playerService');
        await playerService.updateStats(winner, { won: false, draw: false, goalsScored: 0, goalsConceded: 0 });
        const winnerPlayer = await require('../models/Player').findOne({ username: winner });
        if (winnerPlayer) {
            winnerPlayer.stats.tournamentsWon++;
            await winnerPlayer.save();
        }

        // Tüm katılımcılar
        for (const p of tournament.participants) {
            const player = await require('../models/Player').findOne({ username: p.username });
            if (player) {
                player.stats.tournamentsPlayed++;
                await player.save();
            }
        }

        console.log(`[TOURNAMENT] Tamamlandı: ${tournament.name} — Şampiyon: ${winner}`);
    }

    await tournament.save();
    return { tournament };
}

/**
 * Turnuva listesi getir
 */
async function listTournaments() {
    if (!isDBConnected()) return [];
    return Tournament.find({
        status: { $in: ['waiting', 'in_progress'] }
    }).sort({ createdAt: -1 }).limit(20).lean();
}

/**
 * Turnuva detayı getir
 */
async function getTournament(id) {
    if (!isDBConnected()) return null;
    return Tournament.findById(id).lean();
}

module.exports = {
    createTournament, joinTournament, leaveTournament,
    startTournament, recordTournamentMatch,
    listTournaments, getTournament,
    generateBracket
};
