/**
 * Tournament.js - Turnuva Modeli
 */

'use strict';

const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    createdBy: { type: String },

    settings: {
        format: { type: String, enum: ['single_elimination', 'double_elimination', 'round_robin'], default: 'single_elimination' },
        maxPlayers: { type: Number, enum: [4, 8, 16], default: 8 },
        goalLimit: { type: Number, default: 5 },
        fieldId: { type: String, default: 'classic_442' },
        seedByRating: { type: Boolean, default: true }
    },

    status: { type: String, enum: ['waiting', 'in_progress', 'completed', 'cancelled'], default: 'waiting' },

    participants: [{
        username: { type: String },
        seed: { type: Number },
        eliminated: { type: Boolean, default: false },
        joinedAt: { type: Date, default: Date.now }
    }],

    rounds: [{
        roundNumber: { type: Number },
        roundName: { type: String },
        matches: [{
            matchIndex: { type: Number },
            player1: { type: String, default: null },
            player2: { type: String, default: null },
            score1: { type: Number, default: 0 },
            score2: { type: Number, default: 0 },
            winner: { type: String, default: null },
            status: { type: String, enum: ['pending', 'ready', 'in_progress', 'completed'], default: 'pending' },
            matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', default: null }
        }]
    }],

    winner: { type: String, default: null },
    runnerUp: { type: String, default: null },
    startedAt: { type: Date },
    completedAt: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

tournamentSchema.index({ status: 1 });
tournamentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Tournament', tournamentSchema);
