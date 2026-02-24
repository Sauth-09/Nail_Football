/**
 * friendService.js - Arkadaş İşlemleri Servisi
 * 
 * Üye kodu ile arama, arkadaşlık isteği,
 * kabul/red, silme, engelleme işlemleri.
 */

'use strict';

const Player = require('../models/Player');
const { isDBConnected } = require('../db');

const LIMITS = Player.LIMITS || {
    maxFriends: 50,
    maxPendingRequests: 20,
    requestExpireDays: 14
};

/**
 * Üye kodu ile oyuncu ara
 */
async function searchByMemberCode(memberCode, requestingUsername) {
    if (!isDBConnected()) return { error: 'Veritabanı bağlantısı yok' };

    const code = memberCode.toLowerCase().trim();
    if (code.length < 4 || code.length > 5) {
        return { error: 'Geçersiz üye kodu formatı' };
    }

    const player = await Player.findOne({ memberCode: code })
        .select('username memberCode rating stats.totalMatches stats.wins createdAt');

    if (!player) {
        return { found: false, error: null };
    }

    if (player.username === requestingUsername) {
        return { error: 'Kendi kodunla arama yapamazsın' };
    }

    // Zaten arkadaş mı kontrol et
    const requestingPlayer = await Player.findOne({ username: requestingUsername })
        .select('friends outgoingRequests blocked');

    if (!requestingPlayer) {
        return { error: 'Oyuncu bulunamadı' };
    }

    const isFriend = requestingPlayer.friends.some(f => f.username === player.username);
    const hasPending = requestingPlayer.outgoingRequests.some(r => r.to === player.username);

    // Engel kontrolü
    const targetPlayer = await Player.findOne({ username: player.username }).select('blocked');
    const isBlockedByTarget = targetPlayer && targetPlayer.blocked.some(b => b.username === requestingUsername);
    const isBlockedByMe = requestingPlayer.blocked.some(b => b.username === player.username);

    if (isBlockedByTarget || isBlockedByMe) {
        return { found: false, error: null }; // Engellenmiş oyuncuyu gösterme
    }

    const winRate = player.stats.totalMatches > 0
        ? Math.round((player.stats.wins / player.stats.totalMatches) * 100)
        : 0;

    return {
        found: true,
        player: {
            username: player.username,
            memberCode: player.memberCode,
            rating: player.rating,
            totalMatches: player.stats.totalMatches,
            wins: player.stats.wins,
            winRate: winRate,
            createdAt: player.createdAt
        },
        isFriend,
        hasPending
    };
}

/**
 * Arkadaşlık isteği gönder
 */
async function sendFriendRequest(fromUsername, targetMemberCode) {
    if (!isDBConnected()) return { error: 'Veritabanı bağlantısı yok' };

    const fromPlayer = await Player.findOne({ username: fromUsername });
    if (!fromPlayer) return { error: 'Oyuncu bulunamadı' };

    const targetPlayer = await Player.findOne({ memberCode: targetMemberCode.toLowerCase().trim() });
    if (!targetPlayer) return { error: 'Hedef oyuncu bulunamadı' };

    // Kendine istek gönderemez
    if (fromPlayer.username === targetPlayer.username) {
        return { error: 'Kendine arkadaşlık isteği gönderemezsin' };
    }

    // Zaten arkadaş mı
    if (fromPlayer.friends.some(f => f.username === targetPlayer.username)) {
        return { error: 'Zaten arkadaşsınız' };
    }

    // Zaten istek gönderilmiş mi
    if (fromPlayer.outgoingRequests.some(r => r.to === targetPlayer.username)) {
        return { error: 'Zaten istek gönderdin, yanıt bekleniyor' };
    }

    // Karşı tarafın isteği var mı (otomatik kabul)
    const hasIncoming = fromPlayer.incomingRequests.some(r => r.from === targetPlayer.username);
    if (hasIncoming) {
        // Otomatik kabul et
        return await acceptFriendRequest(fromUsername, targetPlayer.username);
    }

    // Engel kontrolü
    if (targetPlayer.blocked.some(b => b.username === fromUsername)) {
        return { error: 'Bu oyuncuya istek gönderilemez' };
    }
    if (fromPlayer.blocked.some(b => b.username === targetPlayer.username)) {
        return { error: 'Engellediğin oyuncuya istek gönderemezsin' };
    }

    // Limit kontrolleri
    if (fromPlayer.friends.length >= LIMITS.maxFriends) {
        return { error: 'Arkadaş listin dolu (max ' + LIMITS.maxFriends + ')' };
    }
    if (fromPlayer.outgoingRequests.length >= LIMITS.maxPendingRequests) {
        return { error: 'Bekleyen istek limitine ulaştın (max ' + LIMITS.maxPendingRequests + ')' };
    }

    // İsteği kaydet
    fromPlayer.outgoingRequests.push({
        to: targetPlayer.username,
        memberCode: targetPlayer.memberCode,
        sentAt: new Date()
    });
    await fromPlayer.save();

    targetPlayer.incomingRequests.push({
        from: fromPlayer.username,
        memberCode: fromPlayer.memberCode,
        sentAt: new Date()
    });
    await targetPlayer.save();

    console.log(`[FRIEND] ${fromUsername} → ${targetPlayer.username} arkadaşlık isteği gönderdi`);

    return {
        success: true,
        to: targetPlayer.username,
        toMemberCode: targetPlayer.memberCode,
        fromMemberCode: fromPlayer.memberCode,
        fromRating: fromPlayer.rating
    };
}

/**
 * Arkadaşlık isteğini kabul et
 */
async function acceptFriendRequest(acceptingUsername, fromUsername) {
    if (!isDBConnected()) return { error: 'Veritabanı bağlantısı yok' };

    const acceptingPlayer = await Player.findOne({ username: acceptingUsername });
    const fromPlayer = await Player.findOne({ username: fromUsername });

    if (!acceptingPlayer || !fromPlayer) return { error: 'Oyuncu bulunamadı' };

    // İstek var mı kontrol
    const reqIdx = acceptingPlayer.incomingRequests.findIndex(r => r.from === fromUsername);
    if (reqIdx === -1) return { error: 'İstek bulunamadı' };

    // Limit kontrolü
    if (acceptingPlayer.friends.length >= LIMITS.maxFriends) {
        return { error: 'Arkadaş listin dolu' };
    }
    if (fromPlayer.friends.length >= LIMITS.maxFriends) {
        return { error: 'Karşı tarafın arkadaş listesi dolu' };
    }

    // İsteği sil
    acceptingPlayer.incomingRequests.splice(reqIdx, 1);
    const outIdx = fromPlayer.outgoingRequests.findIndex(r => r.to === acceptingUsername);
    if (outIdx !== -1) fromPlayer.outgoingRequests.splice(outIdx, 1);

    // Arkadaş olarak ekle
    acceptingPlayer.friends.push({
        username: fromPlayer.username,
        memberCode: fromPlayer.memberCode,
        addedAt: new Date()
    });

    fromPlayer.friends.push({
        username: acceptingPlayer.username,
        memberCode: acceptingPlayer.memberCode,
        addedAt: new Date()
    });

    await acceptingPlayer.save();
    await fromPlayer.save();

    console.log(`[FRIEND] ${acceptingUsername} ↔ ${fromUsername} arkadaş oldu`);

    return {
        success: true,
        accepted: true,
        friend: {
            username: fromPlayer.username,
            memberCode: fromPlayer.memberCode,
            rating: fromPlayer.rating
        },
        acceptedBy: {
            username: acceptingPlayer.username,
            memberCode: acceptingPlayer.memberCode,
            rating: acceptingPlayer.rating
        }
    };
}

/**
 * Arkadaşlık isteğini reddet (sessizce sil)
 */
async function declineFriendRequest(decliningUsername, fromUsername) {
    if (!isDBConnected()) return { error: 'Veritabanı bağlantısı yok' };

    const decliningPlayer = await Player.findOne({ username: decliningUsername });
    if (!decliningPlayer) return { error: 'Oyuncu bulunamadı' };

    const reqIdx = decliningPlayer.incomingRequests.findIndex(r => r.from === fromUsername);
    if (reqIdx === -1) return { error: 'İstek bulunamadı' };

    decliningPlayer.incomingRequests.splice(reqIdx, 1);
    await decliningPlayer.save();

    // Gönderenin outgoing'den SİLME (14 gün sonra otomatik silinecek)
    // Bu sosyal açıdan daha nazik bir yaklaşım

    console.log(`[FRIEND] ${decliningUsername} → ${fromUsername} isteğini reddetti (sessiz)`);
    return { success: true };
}

/**
 * Arkadaşı sil (sessizce)
 */
async function removeFriend(username, friendUsername) {
    if (!isDBConnected()) return { error: 'Veritabanı bağlantısı yok' };

    const player = await Player.findOne({ username });
    const friend = await Player.findOne({ username: friendUsername });

    if (!player || !friend) return { error: 'Oyuncu bulunamadı' };

    // Her iki taraftan da sil
    player.friends = player.friends.filter(f => f.username !== friendUsername);
    friend.friends = friend.friends.filter(f => f.username !== username);

    await player.save();
    await friend.save();

    console.log(`[FRIEND] ${username} ↔ ${friendUsername} arkadaşlık silindi`);
    return { success: true };
}

/**
 * Oyuncuyu engelle
 */
async function blockPlayer(username, targetUsername) {
    if (!isDBConnected()) return { error: 'Veritabanı bağlantısı yok' };

    const player = await Player.findOne({ username });
    if (!player) return { error: 'Oyuncu bulunamadı' };

    if (player.blocked.some(b => b.username === targetUsername)) {
        return { error: 'Zaten engellenmiş' };
    }

    // Engelle
    player.blocked.push({ username: targetUsername, blockedAt: new Date() });

    // Arkadaşsa sil
    player.friends = player.friends.filter(f => f.username !== targetUsername);

    // Bekleyen istekleri sil
    player.incomingRequests = player.incomingRequests.filter(r => r.from !== targetUsername);
    player.outgoingRequests = player.outgoingRequests.filter(r => r.to !== targetUsername);

    await player.save();

    // Karşı taraftan da arkadaşlıktan sil
    const target = await Player.findOne({ username: targetUsername });
    if (target) {
        target.friends = target.friends.filter(f => f.username !== username);
        target.incomingRequests = target.incomingRequests.filter(r => r.from !== username);
        target.outgoingRequests = target.outgoingRequests.filter(r => r.to !== username);
        await target.save();
    }

    console.log(`[FRIEND] ${username} → ${targetUsername} engelledi`);
    return { success: true };
}

/**
 * Engeli kaldır
 */
async function unblockPlayer(username, targetUsername) {
    if (!isDBConnected()) return { error: 'Veritabanı bağlantısı yok' };

    const player = await Player.findOne({ username });
    if (!player) return { error: 'Oyuncu bulunamadı' };

    player.blocked = player.blocked.filter(b => b.username !== targetUsername);
    await player.save();

    console.log(`[FRIEND] ${username} → ${targetUsername} engel kaldırıldı`);
    return { success: true };
}

/**
 * Arkadaş listesini getir
 */
async function getFriendsList(username) {
    if (!isDBConnected()) return [];

    const player = await Player.findOne({ username }).select('friends');
    if (!player) return [];

    return player.friends || [];
}

/**
 * Bekleyen istekleri getir
 */
async function getPendingRequests(username) {
    if (!isDBConnected()) return { incoming: [], outgoing: [] };

    const player = await Player.findOne({ username }).select('incomingRequests outgoingRequests');
    if (!player) return { incoming: [], outgoing: [] };

    // 14 günden eski istekleri lazy delete
    const now = Date.now();
    const expireMs = LIMITS.requestExpireDays * 24 * 60 * 60 * 1000;
    let dirty = false;

    player.incomingRequests = player.incomingRequests.filter(r => {
        if (now - new Date(r.sentAt).getTime() > expireMs) {
            dirty = true;
            return false;
        }
        return true;
    });

    player.outgoingRequests = player.outgoingRequests.filter(r => {
        if (now - new Date(r.sentAt).getTime() > expireMs) {
            dirty = true;
            return false;
        }
        return true;
    });

    if (dirty) await player.save();

    return {
        incoming: player.incomingRequests || [],
        outgoing: player.outgoingRequests || []
    };
}

module.exports = {
    searchByMemberCode,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    blockPlayer,
    unblockPlayer,
    getFriendsList,
    getPendingRequests
};
