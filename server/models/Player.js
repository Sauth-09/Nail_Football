/**
 * Player.js - Oyuncu Profil Modeli
 * 
 * memberCode: Benzersiz 4 haneli üye kodu (örn: a13b, k7x2)
 * friends: Kabul edilmiş arkadaşlıklar
 * incomingRequests: Gelen arkadaşlık istekleri
 * outgoingRequests: Gönderilen arkadaşlık istekleri
 * blocked: Engellenen oyuncular
 */

'use strict';

const mongoose = require('mongoose');

// Karıştırılabilecek karakterler hariç (0, o, 1, l, i)
const MEMBER_CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';

/**
 * 4 haneli benzersiz üye kodu oluştur
 * @returns {string}
 */
function generateMemberCode() {
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += MEMBER_CODE_CHARS.charAt(Math.floor(Math.random() * MEMBER_CODE_CHARS.length));
    }
    return code;
}

const playerSchema = new mongoose.Schema({
    username: {
        type: String,
        unique: true,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 20
    },
    passwordHash: {
        type: String,
        // Not required to allow backward compatibility with older accounts
    },
    token: {
        type: String,
        unique: true,
        required: true
    },
    memberCode: {
        type: String,
        unique: true,
        sparse: true,
        lowercase: true,
        trim: true,
        minlength: 4,
        maxlength: 5,
        index: true
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
    createdAt: { type: Date, default: Date.now },

    // Arkadaş listesi (kabul edilmiş arkadaşlıklar)
    friends: [{
        username: String,
        memberCode: String,
        addedAt: { type: Date, default: Date.now }
    }],

    // Gelen arkadaşlık istekleri
    incomingRequests: [{
        from: String,       // username
        memberCode: String,
        sentAt: { type: Date, default: Date.now }
    }],

    // Gönderilen arkadaşlık istekleri
    outgoingRequests: [{
        to: String,         // username
        memberCode: String,
        sentAt: { type: Date, default: Date.now }
    }],

    // Engellenen oyuncular
    blocked: [{
        username: String,
        blockedAt: { type: Date, default: Date.now }
    }]
});

// Pre-save hook: Yeni oyuncuya otomatik memberCode ata
playerSchema.pre('save', async function (next) {
    if (this.isNew && !this.memberCode) {
        let code;
        let exists = true;
        let attempts = 0;
        const Player = this.constructor;

        while (exists && attempts < 10) {
            code = generateMemberCode();
            const found = await Player.findOne({ memberCode: code });
            exists = !!found;
            attempts++;
        }

        if (exists) {
            return next(new Error('Üye kodu oluşturulamadı'));
        }

        this.memberCode = code;
    }
    next();
});

playerSchema.index({ username: 1 });
playerSchema.index({ rating: -1 });
playerSchema.index({ 'stats.wins': -1 });
playerSchema.index({ memberCode: 1 });

// Sınırlar (dışarıdan erişilebilir)
playerSchema.statics.LIMITS = {
    maxFriends: 50,
    maxPendingRequests: 20,
    requestExpireDays: 14
};

// Statik fonksiyonlar
playerSchema.statics.generateMemberCode = generateMemberCode;

/**
 * Mevcut memberCode'u olmayan oyunculara geriye dönük kod atama
 */
playerSchema.statics.migrateMemberCodes = async function () {
    const players = await this.find({ $or: [{ memberCode: null }, { memberCode: { $exists: false } }] });
    let migrated = 0;

    for (const player of players) {
        let code;
        let exists = true;
        let attempts = 0;

        while (exists && attempts < 10) {
            code = generateMemberCode();
            const found = await this.findOne({ memberCode: code });
            exists = !!found;
            attempts++;
        }

        if (!exists) {
            player.memberCode = code;
            await player.save();
            migrated++;
            console.log(`[MIGRATION] ${player.username} → #${code}`);
        }
    }

    if (migrated > 0) {
        console.log(`[MIGRATION] ${migrated} oyuncuya memberCode atandı.`);
    }
    return migrated;
};

module.exports = mongoose.model('Player', playerSchema);
