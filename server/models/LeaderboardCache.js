/**
 * LeaderboardCache.js - Skor Tablosu Önbellek Modeli
 */

'use strict';

const mongoose = require('mongoose');

const leaderboardCacheSchema = new mongoose.Schema({
    type: { type: String, enum: ['weekly', 'monthly', 'alltime'], required: true },
    periodStart: { type: Date },
    periodEnd: { type: Date },

    entries: [{
        rank: { type: Number },
        username: { type: String },
        wins: { type: Number },
        losses: { type: Number },
        draws: { type: Number },
        goalsScored: { type: Number },
        goalsConceded: { type: Number },
        goalDifference: { type: Number },
        matchesPlayed: { type: Number },
        points: { type: Number },
        rating: { type: Number },
        winRate: { type: Number }
    }],

    generatedAt: { type: Date, default: Date.now }
});

leaderboardCacheSchema.index({ type: 1, periodStart: -1 });

module.exports = mongoose.model('LeaderboardCache', leaderboardCacheSchema);
