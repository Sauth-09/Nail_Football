/**
 * Player.js - Oyuncu Profil Modeli
 */

'use strict';

const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
    username: {
        type: String,
        unique: true,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 20
    },
    token: {
        type: String,
        unique: true,
        required: true
    },
    stats: {
        totalMatches: { type: Number, default: 0 },
        wins: { type: Number, default: 0 },
        losses: { type: Number, default: 0 },
        draws: { type: Number, default: 0 },
        goalsScored: { type: Number, default: 0 },
        goalsConceded: { type: Number, default: 0 },
        winStreak: { type: Number, default: 0 },
        bestWinStreak: { type: Number, default: 0 },
        tournamentsWon: { type: Number, default: 0 },
        tournamentsPlayed: { type: Number, default: 0 }
    },
    rating: { type: Number, default: 1000 },
    lastActive: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now }
});

playerSchema.index({ username: 1 });
playerSchema.index({ rating: -1 });
playerSchema.index({ 'stats.wins': -1 });

module.exports = mongoose.model('Player', playerSchema);
