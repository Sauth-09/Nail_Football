/**
 * db.js - MongoDB Bağlantı Yönetimi
 * 
 * Mongoose ile MongoDB Atlas'a bağlanır.
 * Bağlantı başarısız olursa oyun yine çalışır (DB olmadan).
 */

'use strict';

const mongoose = require('mongoose');

let isConnected = false;

async function connectDB() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.log('[DB] MONGODB_URI tanımlı değil — veritabanı olmadan çalışılıyor');
        return false;
    }

    try {
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000,
            heartbeatFrequencyMS: 10000
        });
        isConnected = true;
        console.log('[DB] MongoDB Atlas bağlantısı başarılı');
        return true;
    } catch (error) {
        console.error('[DB] MongoDB bağlantı hatası:', error.message);
        console.log('[DB] Veritabanı olmadan devam ediliyor');
        return false;
    }
}

mongoose.connection.on('disconnected', () => {
    isConnected = false;
    console.log('[DB] MongoDB bağlantısı kesildi');
});

mongoose.connection.on('reconnected', () => {
    isConnected = true;
    console.log('[DB] MongoDB yeniden bağlandı');
});

function isDBConnected() {
    return isConnected;
}

module.exports = { connectDB, isDBConnected };
