/**
 * trayManager.js - Sistem Tepsisi Yönetimi
 * 
 * systray2 kütüphanesi ile Windows sistem tepsisinde ikon gösterir.
 * Sağ tık menüsü: Sunucu Arayüzü, Oyunu Aç, Çıkış
 */

'use strict';

const SysTray = require('systray2').default || require('systray2');
const path = require('path');
const { exec } = require('child_process');
const logger = require('./logger');

let systray = null;

/**
 * Initializes the system tray icon
 * @param {Object} config
 * @param {string} config.gameUrl - Game URL (e.g. http://192.168.1.x:3000)
 * @param {number} config.managerPort - Manager panel port
 * @param {Function} config.onExit - Callback when user clicks Exit
 */
function init(config) {
    const iconPath = path.join(__dirname, 'managerUI', 'futbol.ico');

    const itemOpenUI = {
        title: 'Sunucu Arayüzünü Aç',
        tooltip: 'Admin panelini tarayıcıda aç',
        checked: false,
        enabled: true,
        click: () => {
            const url = `http://localhost:${config.managerPort}`;
            logger.log('info', `Tarayıcıda açılıyor: ${url}`);
            exec(`start ${url}`);
        }
    };

    const itemOpenGame = {
        title: 'Oyunu Aç',
        tooltip: 'Oyunu tarayıcıda aç',
        checked: false,
        enabled: true,
        click: () => {
            const url = config.gameUrl || `http://localhost:3000`;
            logger.log('info', `Oyun açılıyor: ${url}`);
            exec(`start ${url}`);
        }
    };

    const itemExit = {
        title: 'Çıkış',
        tooltip: 'Sunucuyu kapat ve çık',
        checked: false,
        enabled: true,
        click: () => {
            logger.log('info', 'Kullanıcı tray menüsünden çıkış yaptı');
            if (config.onExit) {
                config.onExit();
            }
            shutdown();
        }
    };

    try {
        systray = new SysTray({
            menu: {
                icon: iconPath,
                title: 'Çivi Futbolu',
                tooltip: 'Çivi Futbolu Sunucusu',
                items: [
                    itemOpenUI,
                    itemOpenGame,
                    SysTray.separator,
                    itemExit
                ]
            },
            debug: false,
            copyDir: false
        });

        systray.onClick(action => {
            if (action.item.click != null) {
                action.item.click();
            }
        });

        systray.ready().then(() => {
            logger.log('info', 'Sistem tepsisi ikonu hazır');
        }).catch(err => {
            logger.log('error', `Sistem tepsisi başlatılamadı: ${err.message}`);
        });

    } catch (err) {
        logger.log('error', `Tray oluşturma hatası: ${err.message}`);
    }
}

/**
 * Shuts down the tray icon
 */
function shutdown() {
    if (systray) {
        try {
            systray.kill(false);
        } catch (e) {
            // Ignore errors during shutdown
        }
        systray = null;
    }
}

module.exports = { init, shutdown };
