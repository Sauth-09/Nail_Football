/**
 * uiManager.js - Kullanıcı Arayüzü Yönetimi
 * 
 * Ekran geçişleri, saha seçim galerisi, ayarlar yönetimi,
 * nasıl oynanır slaytları, HUD güncelleme ve modal diyaloglar.
 * Tüm UI metinleri Türkçe.
 */

'use strict';

const UIManager = (() => {
    /** @type {string} Current active screen ID */
    let currentScreen = 'main-menu';

    /** @type {Object} Game settings */
    let settings = {
        matchTime: 300,       // seconds (0 = unlimited)
        goalLimit: 5,         // (0 = unlimited)
        powerBarSpeed: 1.5,
        theme: 'grass',
        particles: true,
        volume: 70,
        sfx: true,
        vibration: true
    };

    /** @type {Array} Available fields */
    let availableFields = [];

    /** @type {string|null} Selected field ID */
    let selectedFieldId = null;

    /** @type {number} How-to slide index */
    let howtoSlideIndex = 0;

    /** @type {number} Total how-to slides */
    const TOTAL_HOWTO_SLIDES = 5;

    /**
     * Initializes the UI manager
     */
    function init() {
        loadSettings();
        applySettings();
        bindEvents();
        createHowtoDots();

        // Show how-to on first visit
        if (!localStorage.getItem('nf_played_before')) {
            // Will show after first game starts
        }
    }

    /**
     * Binds all UI event listeners
     */
    function bindEvents() {
        // Main menu buttons
        const btnLocal = document.getElementById('btn-local');
        const btnMultiplayer = document.getElementById('btn-multiplayer');
        const btnSettings = document.getElementById('btn-settings');
        const btnHowto = document.getElementById('btn-howto');

        if (btnLocal) btnLocal.addEventListener('click', () => {
            SoundManager.playClick();
            if (typeof Game !== 'undefined') Game.setMode('local');
            showFieldSelect();
        });

        if (btnMultiplayer) btnMultiplayer.addEventListener('click', () => {
            SoundManager.playClick();
            showScreen('multiplayer-lobby');
        });

        if (btnSettings) btnSettings.addEventListener('click', () => {
            SoundManager.playClick();
            showScreen('settings-screen');
        });

        if (btnHowto) btnHowto.addEventListener('click', () => {
            SoundManager.playClick();
            showScreen('howto-screen');
        });

        // Back buttons
        document.querySelectorAll('.back-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                SoundManager.playClick();
                const screenId = e.target.id;
                if (screenId === 'btn-back-game') {
                    showConfirmDialog('Oyundan çıkmak istediğinize emin misiniz?', () => {
                        showScreen('main-menu');
                        if (typeof Game !== 'undefined') Game.stop();
                    });
                } else {
                    showScreen('main-menu');
                }
            });
        });

        // Field selection
        const btnStartGame = document.getElementById('btn-start-game');
        if (btnStartGame) btnStartGame.addEventListener('click', () => {
            SoundManager.playClick();
            if (selectedFieldId && typeof Game !== 'undefined') {
                Game.startGame(selectedFieldId);
            }
        });

        const fieldPrev = document.getElementById('field-prev');
        const fieldNext = document.getElementById('field-next');
        if (fieldPrev) fieldPrev.addEventListener('click', () => {
            scrollFieldGallery(-1);
        });
        if (fieldNext) fieldNext.addEventListener('click', () => {
            scrollFieldGallery(1);
        });

        // Multiplayer lobby
        const btnCreateRoom = document.getElementById('btn-create-room');
        if (btnCreateRoom) btnCreateRoom.addEventListener('click', () => {
            SoundManager.playClick();
            const name = document.getElementById('player-name-input').value.trim() || 'Oyuncu 1';
            if (typeof Game !== 'undefined') Game.setMode('multiplayer');
            NetworkManager.connect().then(connected => {
                if (connected) {
                    NetworkManager.createRoom(name);
                    setLobbyStatus('Oda oluşturuluyor...', 'waiting');
                } else {
                    setLobbyStatus('Sunucuya bağlanılamadı!', 'error');
                }
            });
        });

        const btnJoinRoom = document.getElementById('btn-join-room');
        if (btnJoinRoom) btnJoinRoom.addEventListener('click', () => {
            SoundManager.playClick();
            const name = document.getElementById('player-name-input').value.trim() || 'Oyuncu 2';
            const code = document.getElementById('room-code-input').value.trim().toUpperCase();
            if (!code || code.length !== 4) {
                setLobbyStatus('Geçerli bir oda kodu girin!', 'error');
                return;
            }
            if (typeof Game !== 'undefined') Game.setMode('multiplayer');
            NetworkManager.connect().then(connected => {
                if (connected) {
                    NetworkManager.joinRoom(code, name);
                    setLobbyStatus('Odaya katılınıyor...', 'waiting');
                } else {
                    setLobbyStatus('Sunucuya bağlanılamadı!', 'error');
                }
            });
        });

        // Settings
        bindSettingsEvents();

        // How-to navigation
        const howtoPrev = document.getElementById('howto-prev');
        const howtoNext = document.getElementById('howto-next');
        const howtoSkip = document.getElementById('howto-skip');

        if (howtoPrev) howtoPrev.addEventListener('click', () => { navigateHowto(-1); });
        if (howtoNext) howtoNext.addEventListener('click', () => { navigateHowto(1); });
        if (howtoSkip) howtoSkip.addEventListener('click', () => {
            SoundManager.playClick();
            showScreen('main-menu');
        });

        // Game HUD buttons
        const btnSoundToggle = document.getElementById('btn-sound-toggle');
        if (btnSoundToggle) btnSoundToggle.addEventListener('click', () => {
            settings.sfx = !settings.sfx;
            SoundManager.setSfxEnabled(settings.sfx);
            btnSoundToggle.textContent = settings.sfx ? '🔊' : '🔇';
            saveSettings();
        });

        const btnFullscreen = document.getElementById('btn-fullscreen');
        if (btnFullscreen) btnFullscreen.addEventListener('click', () => {
            toggleFullscreen();
        });

        // Game over modal
        const btnReplay = document.getElementById('btn-replay');
        const btnToMenu = document.getElementById('btn-to-menu');
        if (btnReplay) btnReplay.addEventListener('click', () => {
            SoundManager.playClick();
            hideModal('game-over-modal');
            if (typeof Game !== 'undefined') Game.restart();
        });
        if (btnToMenu) btnToMenu.addEventListener('click', () => {
            SoundManager.playClick();
            hideModal('game-over-modal');
            showScreen('main-menu');
            if (typeof Game !== 'undefined') Game.stop();
        });

        // Confirm modal
        const btnConfirmNo = document.getElementById('btn-confirm-no');
        if (btnConfirmNo) btnConfirmNo.addEventListener('click', () => {
            SoundManager.playClick();
            hideModal('confirm-modal');
        });
    }

    /**
     * Binds settings change events
     */
    function bindSettingsEvents() {
        const settingTime = document.getElementById('setting-time');
        const settingGoalLimit = document.getElementById('setting-goal-limit');
        const settingPowerSpeed = document.getElementById('setting-power-speed');
        const settingTheme = document.getElementById('setting-theme');
        const settingParticles = document.getElementById('setting-particles');
        const settingVolume = document.getElementById('setting-volume');
        const settingSfx = document.getElementById('setting-sfx');
        const settingVibration = document.getElementById('setting-vibration');

        if (settingTime) settingTime.addEventListener('change', () => {
            settings.matchTime = parseInt(settingTime.value);
            saveSettings();
        });
        if (settingGoalLimit) settingGoalLimit.addEventListener('change', () => {
            settings.goalLimit = parseInt(settingGoalLimit.value);
            saveSettings();
        });
        if (settingPowerSpeed) settingPowerSpeed.addEventListener('change', () => {
            settings.powerBarSpeed = parseFloat(settingPowerSpeed.value);
            saveSettings();
        });
        if (settingTheme) settingTheme.addEventListener('change', () => {
            settings.theme = settingTheme.value;
            FieldRenderer.setTheme(settings.theme);
            FieldRenderer.invalidateCache();
            saveSettings();
        });
        if (settingParticles) settingParticles.addEventListener('change', () => {
            settings.particles = settingParticles.value === '1';
            saveSettings();
        });
        if (settingVolume) settingVolume.addEventListener('input', () => {
            settings.volume = parseInt(settingVolume.value);
            SoundManager.setVolume(settings.volume);
            const label = document.getElementById('volume-label');
            if (label) label.textContent = `${settings.volume}%`;
            saveSettings();
        });
        if (settingSfx) settingSfx.addEventListener('change', () => {
            settings.sfx = settingSfx.value === '1';
            SoundManager.setSfxEnabled(settings.sfx);
            saveSettings();
        });
        if (settingVibration) settingVibration.addEventListener('change', () => {
            settings.vibration = settingVibration.value === '1';
            saveSettings();
        });
    }

    /**
     * Shows a screen by ID
     * @param {string} screenId
     */
    function showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const screen = document.getElementById(screenId);
        if (screen) {
            screen.classList.add('active');
            currentScreen = screenId;
        }
    }

    /**
     * Shows the field selection screen with field cards
     */
    function showFieldSelect() {
        // Fetch fields from server or use embedded data
        fetch('/api/fields')
            .then(res => res.json())
            .then(fields => {
                availableFields = fields;
                buildFieldGallery(fields);
                showScreen('field-select');
            })
            .catch(() => {
                // Fallback: use embedded field data
                fetch('/fields/fieldData.json')
                    .then(res => res.json())
                    .then(fields => {
                        availableFields = fields;
                        buildFieldGallery(fields);
                        showScreen('field-select');
                    })
                    .catch(err => {
                        console.error('[ERROR] Saha verileri yüklenemedi:', err);
                    });
            });
    }

    /**
     * Builds the field selection gallery
     * @param {Array} fields
     */
    function buildFieldGallery(fields) {
        const gallery = document.getElementById('field-gallery');
        if (!gallery) return;
        gallery.innerHTML = '';

        fields.forEach((field, index) => {
            const card = document.createElement('div');
            card.className = `field-card${field.isRandom ? ' random-card' : ''}`;
            card.dataset.fieldId = field.id;

            if (index === 0) {
                card.classList.add('selected');
                selectedFieldId = field.id;
            }

            // Preview canvas
            const previewDiv = document.createElement('div');
            previewDiv.className = 'field-preview';
            const previewCanvas = document.createElement('canvas');
            previewCanvas.width = 200;
            previewCanvas.height = 110;
            previewDiv.appendChild(previewCanvas);

            // Render mini preview (we need full field data for this)
            if (!field.isRandom) {
                fetchFieldData(field.id).then(fullField => {
                    if (fullField) {
                        FieldRenderer.drawMiniPreview(previewCanvas, fullField);
                    }
                });
            } else {
                // Random field - draw special
                const pCtx = previewCanvas.getContext('2d');
                pCtx.fillStyle = '#2d5a1b';
                pCtx.fillRect(0, 0, 200, 110);
                pCtx.fillStyle = '#ffffff';
                pCtx.font = '36px Outfit';
                pCtx.textAlign = 'center';
                pCtx.fillText('🎲', 100, 68);
            }

            // Stars
            const starCount = field.difficulty || 3;
            const stars = '★'.repeat(starCount) + '☆'.repeat(5 - starCount);

            const nailInfo = field.isRandom ? '15-35 çivi' : `${field.nailCount} çivi`;

            card.innerHTML = '';
            card.appendChild(previewDiv);

            const nameEl = document.createElement('div');
            nameEl.className = 'field-card-name';
            nameEl.textContent = field.name;
            card.appendChild(nameEl);

            const diffEl = document.createElement('div');
            diffEl.className = 'field-card-difficulty';
            diffEl.textContent = stars;
            card.appendChild(diffEl);

            const infoEl = document.createElement('div');
            infoEl.className = 'field-card-info';
            infoEl.textContent = nailInfo;
            card.appendChild(infoEl);

            const descEl = document.createElement('div');
            descEl.className = 'field-card-desc';
            descEl.textContent = field.description || '';
            card.appendChild(descEl);

            card.addEventListener('click', () => {
                SoundManager.playClick();
                document.querySelectorAll('.field-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                selectedFieldId = field.id;
            });

            gallery.appendChild(card);
        });
    }

    /**
     * Fetches full field data for preview rendering
     * @param {string} fieldId
     * @returns {Promise<Object|null>}
     */
    async function fetchFieldData(fieldId) {
        try {
            const res = await fetch('/fields/fieldData.json');
            const allFields = await res.json();
            return allFields.find(f => f.id === fieldId) || null;
        } catch {
            return null;
        }
    }

    /**
     * Scrolls the field gallery
     * @param {number} direction - -1 for left, 1 for right
     */
    function scrollFieldGallery(direction) {
        const gallery = document.getElementById('field-gallery');
        if (gallery) {
            gallery.scrollBy({ left: direction * 220, behavior: 'smooth' });
        }
    }

    // ═══════════════════════════════════════════
    // How To Play
    // ═══════════════════════════════════════════

    /**
     * Creates dot indicators for how-to slides
     */
    function createHowtoDots() {
        const dotsContainer = document.getElementById('howto-dots');
        if (!dotsContainer) return;
        dotsContainer.innerHTML = '';
        for (let i = 0; i < TOTAL_HOWTO_SLIDES; i++) {
            const dot = document.createElement('div');
            dot.className = `howto-dot${i === 0 ? ' active' : ''}`;
            dotsContainer.appendChild(dot);
        }
    }

    /**
     * Navigates how-to slides
     * @param {number} direction - -1 or 1
     */
    function navigateHowto(direction) {
        howtoSlideIndex = Math.max(0, Math.min(TOTAL_HOWTO_SLIDES - 1, howtoSlideIndex + direction));

        document.querySelectorAll('.howto-slide').forEach(s => s.classList.remove('active'));
        const slide = document.querySelector(`.howto-slide[data-slide="${howtoSlideIndex}"]`);
        if (slide) slide.classList.add('active');

        document.querySelectorAll('.howto-dot').forEach((d, i) => {
            d.classList.toggle('active', i === howtoSlideIndex);
        });

        const prevBtn = document.getElementById('howto-prev');
        const nextBtn = document.getElementById('howto-next');
        if (prevBtn) prevBtn.disabled = howtoSlideIndex === 0;
        if (nextBtn) {
            nextBtn.textContent = howtoSlideIndex === TOTAL_HOWTO_SLIDES - 1 ? 'Tamam' : 'Sonraki →';
            if (howtoSlideIndex === TOTAL_HOWTO_SLIDES - 1) {
                nextBtn.onclick = () => {
                    SoundManager.playClick();
                    showScreen('main-menu');
                    localStorage.setItem('nf_played_before', '1');
                };
            } else {
                nextBtn.onclick = () => { navigateHowto(1); };
            }
        }
    }

    // ═══════════════════════════════════════════
    // HUD Updates
    // ═══════════════════════════════════════════

    /**
     * Updates the score display
     * @param {number} p1Score
     * @param {number} p2Score
     */
    function updateScore(p1Score, p2Score) {
        const p1El = document.getElementById('p1-score');
        const p2El = document.getElementById('p2-score');
        if (p1El) p1El.textContent = p1Score;
        if (p2El) p2El.textContent = p2Score;
    }

    /**
     * Updates the timer display
     * @param {number} seconds - Remaining seconds
     */
    function updateTimer(seconds) {
        const timerEl = document.getElementById('game-timer');
        if (!timerEl) return;
        if (seconds <= 0) {
            timerEl.textContent = '∞';
            return;
        }
        const min = Math.floor(seconds / 60).toString().padStart(2, '0');
        const sec = (seconds % 60).toString().padStart(2, '0');
        timerEl.textContent = `${min}:${sec}`;
    }

    /**
     * Updates the turn indicator
     * @param {number} currentPlayer - 1 or 2
     * @param {string} phase - 'direction', 'power', 'animating', 'waiting'
     */
    function updateTurnIndicator(currentPlayer, phase) {
        const indicator = document.getElementById('turn-text');
        if (!indicator) return;

        const emoji = currentPlayer === 1 ? '🔵' : '🔴';
        const name = currentPlayer === 1 ? 'Oyuncu 1' : 'Oyuncu 2';
        let action = '';

        switch (phase) {
            case 'direction':
                action = 'Yönü Seç!';
                break;
            case 'power':
                action = 'Gücü Ayarla!';
                break;
            case 'animating':
                action = '';
                break;
            case 'waiting':
                action = 'Bekliyor...';
                break;
            default:
                action = '';
        }

        indicator.textContent = `${emoji} ${name}'in Sırası${action ? ' - ' + action : ''}`;

        // Update active player highlight
        const p1 = document.querySelector('.score-p1');
        const p2 = document.querySelector('.score-p2');
        if (p1) p1.classList.toggle('active', currentPlayer === 1);
        if (p2) p2.classList.toggle('active', currentPlayer === 2);
    }

    /**
     * Shows/hides the power bar
     * @param {boolean} visible
     */
    function showPowerBar(visible) {
        const container = document.getElementById('power-bar-container');
        if (container) {
            container.classList.toggle('hidden', !visible);
        }
    }

    /**
     * Updates the power bar fill
     * @param {number} power - Power value (0-1)
     */
    function updatePowerBar(power) {
        const fill = document.getElementById('power-bar-fill');
        if (fill) {
            fill.style.width = `${power * 100}%`;
        }
    }

    /**
     * Locks the power bar with a marker
     * @param {number} power - Locked power value (0-1)
     */
    function lockPowerBar(power) {
        const marker = document.getElementById('power-bar-marker');
        if (marker) {
            marker.style.display = 'block';
            marker.style.left = `${power * 100}%`;
        }
    }

    /**
     * Resets the power bar
     */
    function resetPowerBar() {
        const fill = document.getElementById('power-bar-fill');
        const marker = document.getElementById('power-bar-marker');
        if (fill) fill.style.width = '0%';
        if (marker) marker.style.display = 'none';
    }

    // ═══════════════════════════════════════════
    // Modals
    // ═══════════════════════════════════════════

    /**
     * Shows the game over modal
     * @param {number} winner - Winning player (1 or 2) or 0 for draw
     * @param {number} p1Score
     * @param {number} p2Score
     */
    function showGameOver(winner, p1Score, p2Score) {
        const titleEl = document.getElementById('game-over-title');
        const winnerEl = document.getElementById('game-over-winner');
        const scoreEl = document.getElementById('game-over-score');

        if (titleEl) titleEl.textContent = 'OYUN BİTTİ!';
        if (winnerEl) {
            if (winner === 0) {
                winnerEl.textContent = 'Berabere!';
                winnerEl.style.color = '#f1c40f';
            } else {
                const emoji = winner === 1 ? '🔵' : '🔴';
                winnerEl.textContent = `Kazanan: Oyuncu ${winner} ${emoji}`;
                winnerEl.style.color = winner === 1 ? '#2196F3' : '#F44336';
            }
        }
        if (scoreEl) {
            scoreEl.textContent = `${p1Score}  -  ${p2Score}`;
        }

        showModal('game-over-modal');
    }

    /**
     * Shows a confirmation dialog
     * @param {string} text
     * @param {Function} onConfirm
     */
    function showConfirmDialog(text, onConfirm) {
        const confirmText = document.getElementById('confirm-text');
        if (confirmText) confirmText.textContent = text;

        const btnYes = document.getElementById('btn-confirm-yes');
        if (btnYes) {
            btnYes.onclick = () => {
                SoundManager.playClick();
                hideModal('confirm-modal');
                if (onConfirm) onConfirm();
            };
        }

        showModal('confirm-modal');
    }

    /**
     * Shows a modal
     * @param {string} modalId
     */
    function showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('hidden');
    }

    /**
     * Hides a modal
     * @param {string} modalId
     */
    function hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('hidden');
    }

    // ═══════════════════════════════════════════
    // Lobby Status
    // ═══════════════════════════════════════════

    /**
     * Sets the lobby status message
     * @param {string} text
     * @param {string} type - 'waiting', 'error', 'success'
     */
    function setLobbyStatus(text, type = 'waiting') {
        const statusEl = document.getElementById('lobby-status');
        if (statusEl) {
            statusEl.textContent = text;
            statusEl.className = `lobby-status ${type}`;
        }
    }

    // ═══════════════════════════════════════════
    // Settings Persistence
    // ═══════════════════════════════════════════

    /** Saves settings to localStorage */
    function saveSettings() {
        localStorage.setItem('nf_settings', JSON.stringify(settings));
    }

    /** Loads settings from localStorage */
    function loadSettings() {
        const saved = localStorage.getItem('nf_settings');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                Object.assign(settings, parsed);
            } catch (e) {
                console.error('[ERROR] Ayarlar yüklenemedi:', e);
            }
        }
    }

    /** Applies loaded settings to UI elements */
    function applySettings() {
        const els = {
            'setting-time': settings.matchTime,
            'setting-goal-limit': settings.goalLimit,
            'setting-power-speed': settings.powerBarSpeed,
            'setting-theme': settings.theme,
            'setting-particles': settings.particles ? '1' : '0',
            'setting-volume': settings.volume,
            'setting-sfx': settings.sfx ? '1' : '0',
            'setting-vibration': settings.vibration ? '1' : '0'
        };

        for (const [id, value] of Object.entries(els)) {
            const el = document.getElementById(id);
            if (el) el.value = value;
        }

        const volumeLabel = document.getElementById('volume-label');
        if (volumeLabel) volumeLabel.textContent = `${settings.volume}%`;

        SoundManager.setVolume(settings.volume);
        SoundManager.setSfxEnabled(settings.sfx);
        FieldRenderer.setTheme(settings.theme);
    }

    /**
     * Toggles fullscreen mode
     */
    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.log('[DEBUG] Fullscreen hatası:', err.message);
            });
        } else {
            document.exitFullscreen();
        }
    }

    /**
     * Gets current settings
     * @returns {Object}
     */
    function getSettings() {
        return { ...settings };
    }

    /**
     * @returns {string|null} Selected field ID
     */
    function getSelectedFieldId() {
        return selectedFieldId;
    }

    return {
        init,
        showScreen,
        showFieldSelect,
        updateScore,
        updateTimer,
        updateTurnIndicator,
        showPowerBar,
        updatePowerBar,
        lockPowerBar,
        resetPowerBar,
        showGameOver,
        showConfirmDialog,
        setLobbyStatus,
        getSettings,
        getSelectedFieldId,
        toggleFullscreen
    };
})();
