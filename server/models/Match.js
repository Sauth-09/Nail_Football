/**
 * Match.js - Maç Kayıt Modeli
 */

'use strict';

const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
    player1: {
        username: { type: String, required: true },
        score: { type: Number, required: true }
    },
    player2: {
        username: { type: String, required: true },
        score: { type: Number, required: true }
    },
    winner: { type: String, default: null },
    fieldId: { type: String },
    goalLimit: { type: Number },
    tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', default: null },
    tournamentRound: { type: Number, default: null },
    duration: { type: Number },
    totalShots: { type: Number },
    playedAt: { type: Date, default: Date.now }
});

matchSchema.index({ playedAt: -1 });
matchSchema.index({ 'player1.username': 1 });
matchSchema.index({ 'player2.username': 1 });
matchSchema.index({ tournamentId: 1 });

module.exports = mongoose.model('Match', matchSchema);
