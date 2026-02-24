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
        matchTime: 300,
        goalLimit: 5,
        powerBarSpeed: 1.5,
        friction: 0.985,
        theme: 'grass',
        particles: true,
        volume: 70,
        sfx: true,
        vibration: true,
        goalkeeperEnabled: true,
        goalkeeperSize: 30
    };

    /** @type {Array} Available fields */
    let availableFields = [];

    /** @type {string|null} Selected field ID */
    let selectedFieldId = null;

    /** @type {number} How-to slide index */
    let howtoSlideIndex = 0;

    /** @type {number} Total how-to slides */
    const TOTAL_HOWTO_SLIDES = 5;

    /** @type {boolean} Whether current field select is for multiplayer */
    let isMultiplayerFieldSelect = false;

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
        const btnTournament = document.getElementById('btn-tournament');
        const btnLeaderboard = document.getElementById('btn-leaderboard');
        const btnProfile = document.getElementById('btn-profile');

        if (btnLocal) btnLocal.addEventListener('click', () => {
            SoundManager.playClick();
            if (typeof Game !== 'undefined') Game.setMode('local');
            showFieldSelect();
        });

        const btnVsAi = document.getElementById('btn-vs-ai');
        if (btnVsAi) btnVsAi.addEventListener('click', () => {
            SoundManager.playClick();
            if (typeof Game !== 'undefined') Game.setMode('vs_ai');
            showScreen('ai-difficulty-screen');
        });

        if (btnMultiplayer) btnMultiplayer.addEventListener('click', () => {
            SoundManager.playClick();
            showScreen('multiplayer-lobby');
        });

        if (btnTournament) btnTournament.addEventListener('click', () => {
            SoundManager.playClick();
            showScreen('tournament-screen');
            if (typeof TournamentUI !== 'undefined') TournamentUI.loadTournamentList();
        });

        if (btnLeaderboard) btnLeaderboard.addEventListener('click', () => {
            SoundManager.playClick();
            showScreen('leaderboard-screen');
            if (typeof LeaderboardUI !== 'undefined') LeaderboardUI.loadLeaderboard('weekly');
        });

        if (btnProfile) btnProfile.addEventListener('click', () => {
            SoundManager.playClick();
            if (typeof AuthManager !== 'undefined' && !AuthManager.isLoggedIn()) {
                showScreen('auth-screen');
            } else {
                showScreen('profile-screen');
                if (typeof AuthManager !== 'undefined') {
                    AuthManager.updateProfileDisplay();
                    AuthManager.loadRecentMatches();
                }
            }
        });

        if (btnSettings) btnSettings.addEventListener('click', () => {
            SoundManager.playClick();
            showScreen('settings-screen');
        });

        if (btnHowto) btnHowto.addEventListener('click', () => {
            SoundManager.playClick();
            showScreen('howto-screen');
        });

        // Auth buttons
        const btnAuthRegister = document.getElementById('btn-auth-register');
        const btnAuthLogin = document.getElementById('btn-auth-login');
        const btnAuthSkip = document.getElementById('btn-auth-skip');
        if (btnAuthRegister) btnAuthRegister.addEventListener('click', () => {
            const username = document.getElementById('auth-username')?.value?.trim();
            const password = document.getElementById('auth-password')?.value?.trim();
            if (!username || username.length < 2) {
                const err = document.getElementById('auth-error');
                if (err) { err.textContent = 'Kullanıcı adı en az 2 karakter olmalı'; err.style.display = 'block'; }
                return;
            }
            if (!password || password.length < 4) {
                const err = document.getElementById('auth-error');
                if (err) { err.textContent = 'Şifre en az 4 karakter olmalı'; err.style.display = 'block'; }
                return;
            }
            AuthManager.register(username, password);
        });
        if (btnAuthLogin) btnAuthLogin.addEventListener('click', () => {
            const username = document.getElementById('auth-username')?.value?.trim();
            const password = document.getElementById('auth-password')?.value?.trim();
            if (!username || !password) {
                const err = document.getElementById('auth-error');
                if (err) { err.textContent = 'Kullanıcı adı ve şifre gereklidir'; err.style.display = 'block'; }
                return;
            }
            AuthManager.login(username, password);
        });
        if (btnAuthSkip) btnAuthSkip.addEventListener('click', () => {
            AuthManager.skipAuth();
            showScreen('main-menu');
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
                } else if (screenId === 'btn-back-field') {
                    // Eğer AI modundaysak, geri dönünce zorluk seçimine gitsin, yoksa ana menüye
                    if (typeof Game !== 'undefined' && Game.getMode() === 'vs_ai') {
                        showScreen('ai-difficulty-screen');
                    } else {
                        showScreen('main-menu');
                    }
                } else {
                    showScreen('main-menu');
                }
            });
        });

        // AI Difficulty Selection
        document.querySelectorAll('.difficulty-card .menu-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                SoundManager.playClick();
                const card = e.target.closest('.difficulty-card');
                if (card && typeof Game !== 'undefined') {
                    const diff = card.dataset.level; // 'easy', 'medium', 'hard'
                    Game.setAIDifficulty(diff);
                    showFieldSelect(); // Zorluk seçilince saha seçimine geç
                }
            });
        });

        // Field selection
        const btnStartGame = document.getElementById('btn-start-game');
        if (btnStartGame) btnStartGame.addEventListener('click', () => {
            SoundManager.playClick();
            if (selectedFieldId && typeof Game !== 'undefined') {
                if (isMultiplayerFieldSelect) {
                    // Multiplayer: send field selection and confirm to server
                    NetworkManager.selectField(selectedFieldId);
                    NetworkManager.confirmField(getSettings());
                    btnStartGame.disabled = true;
                    btnStartGame.textContent = 'Başlatılıyor...';
                } else {
                    // Local mode: start game directly
                    Game.startGame(selectedFieldId);
                }
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
            const code = document.getElementById('room-code-input').value.trim();
            if (!code || code.length !== 4) {
                setLobbyStatus('4 haneli oda kodunu girin!', 'error');
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

        // ── Friends Screen ──
        const btnFriends = document.getElementById('btn-friends');
        if (btnFriends) btnFriends.addEventListener('click', () => {
            SoundManager.playClick();
            if (typeof AuthManager !== 'undefined' && !AuthManager.isLoggedIn()) {
                showScreen('auth-screen');
            } else {
                showScreen('friends-screen');
                // Üye kodunu göster
                const player = AuthManager.getPlayer();
                const codeEl = document.getElementById('my-member-code');
                if (codeEl && player) codeEl.textContent = '#' + (player.memberCode || '----');
                // Listeyi yenile
                if (typeof FriendsManager !== 'undefined') FriendsManager.refreshFriendsList();
            }
        });

        const btnCopyCode = document.getElementById('btn-copy-code');
        if (btnCopyCode) btnCopyCode.addEventListener('click', () => {
            if (typeof FriendsManager !== 'undefined') FriendsManager.copyMemberCode();
        });

        const btnFriendSearch = document.getElementById('btn-friend-search');
        if (btnFriendSearch) btnFriendSearch.addEventListener('click', () => {
            const input = document.getElementById('friend-search-input');
            if (input && typeof FriendsManager !== 'undefined') {
                FriendsManager.searchMember(input.value.trim());
            }
        });

        // Enter tuşu ile arama
        const friendSearchInput = document.getElementById('friend-search-input');
        if (friendSearchInput) friendSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && typeof FriendsManager !== 'undefined') {
                FriendsManager.searchMember(friendSearchInput.value.trim());
            }
        });

        // ── Challenge Modal ──
        // Saha seçim butonları
        document.querySelectorAll('.challenge-field-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.challenge-field-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            });
        });

        // Gol limiti butonları
        document.querySelectorAll('.challenge-goal-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.challenge-goal-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            });
        });

        const btnChallengeSend = document.getElementById('btn-challenge-send');
        if (btnChallengeSend) btnChallengeSend.addEventListener('click', () => {
            if (typeof ChallengeUI !== 'undefined') ChallengeUI.sendChallenge();
        });

        const btnChallengeCancel = document.getElementById('btn-challenge-cancel');
        if (btnChallengeCancel) btnChallengeCancel.addEventListener('click', () => {
            hideModal('challenge-modal');
        });

        const btnChallengeCancelWaiting = document.getElementById('btn-challenge-cancel-waiting');
        if (btnChallengeCancelWaiting) btnChallengeCancelWaiting.addEventListener('click', () => {
            if (typeof ChallengeUI !== 'undefined') ChallengeUI.cancelChallenge();
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
        const settingArrowLength = document.getElementById('setting-arrow-length');
        if (settingArrowLength) settingArrowLength.addEventListener('change', () => {
            settings.arrowLength = parseInt(settingArrowLength.value) || 110;
            saveSettings();
        });
        const settingFriction = document.getElementById('setting-friction');
        if (settingFriction) settingFriction.addEventListener('input', () => {
            settings.friction = parseFloat(settingFriction.value);
            const label = document.getElementById('friction-label');
            if (label) {
                // min: 0.970 (max friction, sticky), max: 0.998 (min friction, slippery)
                const percent = Math.round(((settings.friction - 0.970) / (0.998 - 0.970)) * 100);

                let text = "Orta";
                if (percent < 33) text = "Yapışkan";
                else if (percent > 66) text = "Kaygan";

                label.textContent = `%${percent} - ${text}`;
            }
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

        // Effects toggles
        const fxKeys = ['sparks', 'speedTrail', 'screenShake', 'goalNetRip', 'goalSlowMo', 'ballGlow', 'nearMiss', 'hitSounds'];
        fxKeys.forEach(key => {
            const el = document.getElementById('fx-' + key);
            if (el) el.addEventListener('change', () => {
                if (typeof EffectsManager !== 'undefined') {
                    EffectsManager.setSetting(key, el.checked);
                }
            });
        });

        // Goalkeeper Toggle & Size (Local/Host)
        const gkToggle = document.getElementById('gk-toggle');
        const gkSize = document.getElementById('gk-size');
        if (gkToggle) {
            gkToggle.addEventListener('change', () => {
                settings.goalkeeperEnabled = gkToggle.checked;
                saveSettings();
            });
        }
        if (gkSize) {
            gkSize.addEventListener('change', () => {
                settings.goalkeeperSize = parseInt(gkSize.value) || 30;
                saveSettings();
            });
        }

        // Challenge Goalkeeper Toggle & Size
        const challengeGkToggle = document.getElementById('challenge-gk-toggle');
        const challengeGkSize = document.getElementById('challenge-gk-size');
        if (challengeGkToggle) {
            challengeGkToggle.addEventListener('change', () => {
                settings.goalkeeperEnabled = challengeGkToggle.checked;
                saveSettings();
            });
        }
        if (challengeGkSize) {
            challengeGkSize.addEventListener('change', () => {
                settings.goalkeeperSize = parseInt(challengeGkSize.value) || 30;
                saveSettings();
            });
        }
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
        fetch('/fields/fieldData.json')
            .then(res => res.json())
            .then(fields => {
                availableFields = fields;
                buildFieldGallery(fields);
                isMultiplayerFieldSelect = false;
                // Reset start button for local mode
                const btnStartGame = document.getElementById('btn-start-game');
                if (btnStartGame) {
                    btnStartGame.style.display = '';
                    btnStartGame.disabled = false;
                    btnStartGame.textContent = 'OYUNU BAŞLAT';
                }
                showScreen('field-select');
            })
            .catch(() => {
                // Fallback: use embedded field data
                fetch('/fields/fieldData.json')
                    .then(res => res.json())
                    .then(fields => {
                        availableFields = fields;
                        buildFieldGallery(fields);
                        isMultiplayerFieldSelect = false;
                        showScreen('field-select');
                    })
                    .catch(err => {
                        console.error('[ERROR] Saha verileri yüklenemedi:', err);
                    });
            });
    }

    /**
     * Shows the field selection screen with provided fields (for multiplayer)
     * @param {Array} fields - Field list from server
     * @param {string} mode - Game mode ('local' or 'multiplayer')
     */
    function showFieldSelectWithFields(fields, mode) {
        availableFields = fields;
        buildFieldGallery(fields);
        isMultiplayerFieldSelect = (mode === 'multiplayer');

        const btnStartGame = document.getElementById('btn-start-game');
        const myId = NetworkManager.getPlayerId();

        if (isMultiplayerFieldSelect && myId !== 1) {
            // Joiner: hide start button, show waiting message
            if (btnStartGame) {
                btnStartGame.textContent = 'Kurucu sahayı seçiyor...';
                btnStartGame.disabled = true;
                btnStartGame.style.display = '';
            }
        } else {
            // Host or local: show start button normally
            if (btnStartGame) {
                btnStartGame.textContent = 'OYUNU BAŞLAT';
                btnStartGame.disabled = false;
                btnStartGame.style.display = '';
            }
        }

        showScreen('field-select');
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

            const nailInfo = field.isRandom ? '15-35 çivi' : `${field.nails ? field.nails.length : 0} çivi`;

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
            case 'owngoal':
                action = 'Kendi Kalesine Gol! ⚠️';
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
        const eloEl = document.getElementById('game-over-elo');

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
        if (eloEl) {
            eloEl.style.display = 'none'; // clear previous
            eloEl.innerHTML = '';
        }

        showModal('game-over-modal');
    }

    /**
     * Show Elo changes in Game Over modal
     * @param {Object} eloChanges { p1: { old, new, change }, p2: ... }
     */
    function showGameOverElo(eloChanges) {
        const eloEl = document.getElementById('game-over-elo');
        if (!eloEl || !eloChanges) return;

        // Sadece p1'in değişimini göstersek yeterli (kendisi)
        const myChange = eloChanges.p1;
        if (!myChange) return;

        const isPositive = myChange.change >= 0;
        const changeClass = isPositive ? 'positive' : 'negative';
        const sign = isPositive ? '+' : '';

        eloEl.innerHTML = `
            <div class="elo-change">
                <span>Rating: <strong>${myChange.old} → ${myChange.new}</strong></span>
                <span class="${changeClass}">(${sign}${myChange.change})</span>
            </div>
        `;
        eloEl.style.display = 'block';
    }

    /**
     * Show UI Notification Toast
     * @param {string} message
     */
    function showNotification(message) {
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = 'notification-toast';
        toast.textContent = message;

        container.appendChild(toast);

        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 4000);
    }

    /**
     * Shows a message bubble from the AI
     * @param {string} message
     * @param {string} emoji
     * @param {number} duration
     */
    function showAIMessage(message, emoji = '🤖', duration = 4000) {
        let container = document.getElementById('ai-message-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'ai-message-container';
            container.className = 'ai-message-container';

            // Oyun içi HUD'a eklemeye çalış
            const hud = document.querySelector('.game-hud');
            if (hud) {
                hud.appendChild(container);
            } else {
                document.body.appendChild(container); // fallback
            }
        }

        const bubble = document.createElement('div');
        bubble.className = 'ai-message-bubble';
        bubble.innerHTML = `<span class="ai-emoji">${emoji}</span><span class="ai-text">${message}</span>`;

        container.innerHTML = ''; // Bir önceki mesajı temizle
        container.appendChild(bubble);

        // Animasyon için reflow
        void bubble.offsetWidth;
        bubble.classList.add('show');

        setTimeout(() => {
            if (bubble.parentNode) {
                bubble.classList.remove('show');
                setTimeout(() => {
                    if (bubble.parentNode) {
                        bubble.parentNode.removeChild(bubble);
                    }
                }, 300); // fade out süresi
            }
        }, duration);
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
            'setting-friction': settings.friction,
            'setting-arrow-length': settings.arrowLength,
            'setting-theme': settings.theme,
            'setting-particles': settings.particles ? '1' : '0',
            'setting-volume': settings.volume,
            'setting-sfx': settings.sfx ? '1' : '0',
            'setting-vibration': settings.vibration ? '1' : '0'
        };

        for (const [id, value] of Object.entries(els)) {
            const el = document.getElementById(id);
            if (el && value !== undefined) el.value = value;
        }

        const gkToggle = document.getElementById('gk-toggle');
        const gkSize = document.getElementById('gk-size');
        if (gkToggle) gkToggle.checked = settings.goalkeeperEnabled;
        if (gkSize && settings.goalkeeperSize) gkSize.value = settings.goalkeeperSize;

        const challengeGkToggle = document.getElementById('challenge-gk-toggle');
        const challengeGkSize = document.getElementById('challenge-gk-size');
        if (challengeGkToggle) challengeGkToggle.checked = settings.goalkeeperEnabled;
        if (challengeGkSize && settings.goalkeeperSize) challengeGkSize.value = settings.goalkeeperSize;

        const volumeLabel = document.getElementById('volume-label');
        if (volumeLabel) volumeLabel.textContent = `${settings.volume}%`;

        const frictionLabel = document.getElementById('friction-label');
        if (frictionLabel && settings.friction !== undefined) {
            const percent = Math.round(((settings.friction - 0.970) / (0.998 - 0.970)) * 100);
            let text = "Orta";
            if (percent < 33) text = "Yapışkan";
            else if (percent > 66) text = "Kaygan";
            frictionLabel.textContent = `%${percent} - ${text}`;
        }

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
        showFieldSelectWithFields,
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
        toggleFullscreen,
        showGameOverElo,
        showNotification,
        showAIMessage
    };
})();
