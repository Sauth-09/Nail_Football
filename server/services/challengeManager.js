/**
 * challengeManager.js - Oyun Daveti (Meydan Okuma) Yönetimi
 * 
 * Tamamen RAM'de yönetilir, DB'ye yazılmaz.
 * 30 saniye timeout ile otomatik expire.
 */

'use strict';

const crypto = require('crypto');

class ChallengeManager {
    constructor(onlineTracker) {
        this.onlineTracker = onlineTracker;

        // Aktif davetler: challengeId → ChallengeData
        this.challenges = new Map();

        // Oyuncu başına aktif davet: username → challengeId
        this.playerChallenges = new Map();

        // Timeout referansları: challengeId → timeoutId
        this.timeouts = new Map();
    }

    /**
     * Yeni oyun daveti oluştur
     */
    async createChallenge(fromUsername, targetUsername, fieldId, goalLimit, Player, goalkeeperEnabled, goalkeeperSize) {
        // Kontroller
        if (fromUsername === targetUsername) {
            return { error: 'Kendine davet gönderemezsin' };
        }

        if (this.playerChallenges.has(fromUsername)) {
            return { error: 'Zaten bekleyen bir davetin var. Önce iptal et.' };
        }

        const targetStatus = this.onlineTracker.getStatus(targetUsername);
        if (targetStatus === 'offline') {
            return { error: 'Bu oyuncu çevrimdışı' };
        }
        if (targetStatus === 'in_game') {
            return { error: 'Bu oyuncu şu an oyunda' };
        }

        // Arkadaş mı kontrol et
        const fromPlayer = await Player.findOne({ username: fromUsername })
            .select('friends memberCode rating blocked');
        if (!fromPlayer) return { error: 'Oyuncu bulunamadı' };

        const isFriend = fromPlayer.friends.some(f => f.username === targetUsername);
        if (!isFriend) {
            return { error: 'Sadece arkadaşlarına davet gönderebilirsin' };
        }

        // Engel kontrolü
        const targetPlayer = await Player.findOne({ username: targetUsername })
            .select('blocked memberCode rating');
        if (!targetPlayer) return { error: 'Hedef oyuncu bulunamadı' };

        const isBlocked = targetPlayer.blocked.some(b => b.username === fromUsername);
        if (isBlocked) {
            return { error: 'Bu oyuncuya davet gönderilemiyor' };
        }

        // Challenge ID oluştur
        const challengeId = crypto.randomUUID().substring(0, 8);
        const expiresIn = 30000; // 30 saniye

        const challenge = {
            id: challengeId,
            from: fromUsername,
            fromMemberCode: fromPlayer.memberCode,
            fromRating: fromPlayer.rating,
            to: targetUsername,
            toMemberCode: targetPlayer.memberCode,
            toRating: targetPlayer.rating,
            fieldId: fieldId || 'classic_442',
            goalLimit: goalLimit || 5,
            goalkeeperEnabled: goalkeeperEnabled,
            goalkeeperSize: goalkeeperSize,
            status: 'pending',
            createdAt: Date.now(),
            expiresAt: Date.now() + expiresIn
        };

        this.challenges.set(challengeId, challenge);
        this.playerChallenges.set(fromUsername, challengeId);

        // Hedef oyuncuya bildirim gönder
        this.onlineTracker.sendTo(targetUsername, {
            type: 'GAME_CHALLENGE_RECEIVED',
            challengeId: challengeId,
            from: fromUsername,
            fromMemberCode: fromPlayer.memberCode,
            fromRating: fromPlayer.rating,
            fieldId: fieldId || 'classic_442',
            goalLimit: goalLimit || 5,
            goalkeeperEnabled: goalkeeperEnabled,
            goalkeeperSize: goalkeeperSize,
            expiresIn: expiresIn
        });

        // 30 saniye sonra expire et
        const timeoutId = setTimeout(() => {
            this.expireChallenge(challengeId);
        }, expiresIn);
        this.timeouts.set(challengeId, timeoutId);

        console.log(`[CHALLENGE] ${fromUsername} → ${targetUsername} davet gönderdi (${challengeId})`);

        return {
            success: true,
            challengeId: challengeId,
            to: targetUsername,
            toMemberCode: targetPlayer.memberCode,
            toRating: targetPlayer.rating,
            fieldId: fieldId,
            goalLimit: goalLimit,
            expiresIn: expiresIn
        };
    }

    /**
     * Daveti kabul et
     */
    async acceptChallenge(challengeId, acceptingUsername, Player) {
        const challenge = this.challenges.get(challengeId);

        if (!challenge) {
            return { error: 'Davet bulunamadı veya süresi doldu' };
        }
        if (challenge.to !== acceptingUsername) {
            return { error: 'Bu davet sana ait değil' };
        }
        if (challenge.status !== 'pending') {
            return { error: 'Bu davet artık geçerli değil' };
        }

        challenge.status = 'accepted';

        // Oda kodu oluştur
        const roomCode = Math.floor(1000 + Math.random() * 9000).toString();

        const responseData = {
            type: 'GAME_CHALLENGE_ACCEPTED',
            challengeId: challengeId,
            roomCode: roomCode,
            fieldId: challenge.fieldId,
            goalLimit: challenge.goalLimit,
            goalkeeperEnabled: challenge.goalkeeperEnabled,
            goalkeeperSize: challenge.goalkeeperSize
        };

        // Davet edene bildir
        this.onlineTracker.sendTo(challenge.from, {
            ...responseData,
            opponent: challenge.to,
            opponentMemberCode: challenge.toMemberCode,
            opponentRating: challenge.toRating
        });

        // Kabul edene bildir
        this.onlineTracker.sendTo(challenge.to, {
            ...responseData,
            opponent: challenge.from,
            opponentMemberCode: challenge.fromMemberCode,
            opponentRating: challenge.fromRating
        });

        console.log(`[CHALLENGE] ${acceptingUsername} daveti kabul etti (${challengeId}) → Oda: ${roomCode}`);

        // Temizlik
        this.cleanup(challengeId);

        return { success: true, roomCode: roomCode, challenge: challenge };
    }

    /**
     * Daveti reddet
     */
    declineChallenge(challengeId, decliningUsername) {
        const challenge = this.challenges.get(challengeId);
        if (!challenge || challenge.to !== decliningUsername) return;
        if (challenge.status !== 'pending') return;

        challenge.status = 'declined';

        // Davet edene bildir: "Ali şu an müsait değil"
        this.onlineTracker.sendTo(challenge.from, {
            type: 'GAME_CHALLENGE_DECLINED',
            challengeId: challengeId
        });

        console.log(`[CHALLENGE] ${decliningUsername} daveti reddetti (${challengeId})`);
        this.cleanup(challengeId);
    }

    /**
     * Daveti iptal et (gönderen taraf)
     */
    cancelChallenge(challengeId, cancellingUsername) {
        const challenge = this.challenges.get(challengeId);
        if (!challenge || challenge.from !== cancellingUsername) return;
        if (challenge.status !== 'pending') return;

        challenge.status = 'cancelled';

        // Davet edilene bildir (bildirimi kaldırsın)
        this.onlineTracker.sendTo(challenge.to, {
            type: 'GAME_CHALLENGE_CANCELLED',
            challengeId: challengeId
        });

        console.log(`[CHALLENGE] ${cancellingUsername} daveti iptal etti (${challengeId})`);
        this.cleanup(challengeId);
    }

    /**
     * Davet süresi doldu
     */
    expireChallenge(challengeId) {
        const challenge = this.challenges.get(challengeId);
        if (!challenge || challenge.status !== 'pending') return;

        challenge.status = 'expired';

        // İki tarafa da bildir
        this.onlineTracker.sendTo(challenge.from, {
            type: 'GAME_CHALLENGE_EXPIRED',
            challengeId: challengeId
        });
        this.onlineTracker.sendTo(challenge.to, {
            type: 'GAME_CHALLENGE_EXPIRED',
            challengeId: challengeId
        });

        console.log(`[CHALLENGE] Davet süresi doldu (${challengeId})`);
        this.cleanup(challengeId);
    }

    /**
     * Temizlik
     */
    cleanup(challengeId) {
        const challenge = this.challenges.get(challengeId);
        if (challenge) {
            this.playerChallenges.delete(challenge.from);
            this.challenges.delete(challengeId);
        }
        const timeoutId = this.timeouts.get(challengeId);
        if (timeoutId) {
            clearTimeout(timeoutId);
            this.timeouts.delete(challengeId);
        }
    }

    /**
     * Oyuncu disconnect olursa aktif davetlerini temizle
     */
    handleDisconnect(username) {
        // Gönderen olarak aktif daveti var mı?
        const challengeId = this.playerChallenges.get(username);
        if (challengeId) {
            const challenge = this.challenges.get(challengeId);
            if (challenge && challenge.status === 'pending') {
                if (challenge.from === username) {
                    this.cancelChallenge(challengeId, username);
                } else {
                    this.declineChallenge(challengeId, username);
                }
            }
        }

        // Alıcı olarak aktif daveti var mı kontrol et
        for (const [cId, ch] of this.challenges) {
            if (ch.to === username && ch.status === 'pending') {
                this.declineChallenge(cId, username);
            }
        }
    }
}

module.exports = ChallengeManager;
