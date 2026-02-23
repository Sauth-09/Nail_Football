/**
 * main.js - Uygulama Giriş Noktası
 * 
 * Oyun durumu yönetimi, ana oyun döngüsü,
 * modüller arası koordinasyon ve oyun akışı kontrolü.
 * 
 * Oyun Akışı:
 * 1. Ana menü → Mod seçimi
 * 2. Saha seçimi → Oyun başlangıcı
 * 3. Sıra döngüsü: Yön seç → Güç seç → Top hareketi → Sıra değiş
 * 4. Gol/süre → Oyun sonu
 */

'use strict';

const Game = (() => {
    // ═══════════════════════════════════════════
    // Oyun Durumu
    // ═══════════════════════════════════════════

    /** @type {string} Game mode: 'local' | 'multiplayer' | 'vs_ai' */
    let gameMode = 'local';

    /** @type {string} Game state: 'idle', 'direction', 'power', 'animating', 'goal', 'gameover' */
    let gameState = 'idle';

    /** @type {Object|null} Current field config */
    let currentField = null;

    /** @type {Object} Ball position */
    let ballPos = { x: 0, y: 0 };

    /** @type {number} Current player (1 or 2) */
    let currentPlayer = 1;

    /** @type {Array<number>} Scores [p1, p2] */
    let scores = [0, 0];

    /** @type {number|null} Shot angle in radians */
    let shotAngle = null;

    /** @type {number} Power bar value (0-1) */
    let powerValue = 0;

    /** @type {number} Power bar direction (1 = up, -1 = down) */
    let powerDirection = 1;

    /** @type {number|null} Animation frame ID */
    let animFrameId = null;

    /** @type {number} Match timer (remaining seconds) */
    let matchTimer = 0;

    /** @type {number} Last timer tick timestamp */
    let lastTimerTick = 0;

    /** @type {boolean} Whether game is active */
    let gameActive = false;

    /** @type {Object|null} Pending turn change data (queued during animation) */
    let pendingTurnChange = null;

    /** @type {Object|null} Pending goal scored data (queued during animation) */
    let pendingGoalScored = null;

    // ═══════════════════════════════════════════
    // AI Değişkenleri
    // ═══════════════════════════════════════════
    /** @type {AIPlayer|null} The AI player instance */
    let aiPlayer = null;
    /** @type {string} Current AI difficulty */
    let aiDifficulty = 'easy';

    // ═══════════════════════════════════════════
    // Başlatma
    // ═══════════════════════════════════════════

    /**
     * Initializes the application
     */
    function init() {
        console.log('[INFO] Çivi Futbolu başlatılıyor...');

        // Initialize modules
        SoundManager.init();
        UIManager.init();

        // Initialize renderer
        const canvas = document.getElementById('game-canvas');
        if (canvas) {
            GameRenderer.init(canvas);
            InputHandler.init(canvas);
        }

        // Set up input callbacks
        InputHandler.setCallbacks({
            onDirectionChange: handleDirectionChange,
            onDirectionConfirm: handleDirectionConfirm,
            onPowerLock: handlePowerLock
        });

        // Set up network callbacks
        NetworkManager.setCallbacks({
            onMessage: handleNetworkMessage,
            onStatusChange: handleNetworkStatus
        });

        // Initialize new modules
        if (typeof AuthManager !== 'undefined') AuthManager.init();
        if (typeof LeaderboardUI !== 'undefined') LeaderboardUI.init();
        if (typeof TournamentUI !== 'undefined') TournamentUI.init();

        console.log('[INFO] Çivi Futbolu hazır!');
    }

    // ═══════════════════════════════════════════
    // Oyun Modu
    // ═══════════════════════════════════════════

    /**
     * Sets the game mode
     * @param {string} mode - 'local' | 'multiplayer' | 'vs_ai'
     */
    function setMode(mode) {
        gameMode = mode;
        console.log(`[INFO] Oyun modu: ${mode}`);
    }

    /**
     * Sets AI Difficulty
     * @param {string} diff
     */
    function setAIDifficulty(diff) {
        aiDifficulty = diff;
        console.log(`[INFO] AI Zorluğu: ${diff}`);
    }

    // ═══════════════════════════════════════════
    // Oyun Başlangıcı
    // ═══════════════════════════════════════════

    /**
     * Starts a game with the selected field
     * @param {string} fieldId
     */
    async function startGame(fieldId) {
        console.log(`[INFO] Oyun başlıyor: Saha ${fieldId}`);

        // Fetch full field data
        try {
            const res = await fetch('/fields/fieldData.json');
            const allFields = await res.json();
            let field = allFields.find(f => f.id === fieldId);

            if (!field) {
                console.error('[ERROR] Saha bulunamadı:', fieldId);
                return;
            }

            // Handle random field
            if (field.isRandom) {
                field = { ...field, nails: generateRandomNails(field) };
            }

            currentField = field;
        } catch (error) {
            console.error('[ERROR] Saha verisi yüklenemedi:', error);
            return;
        }

        // Reset game state
        scores = [0, 0];
        currentPlayer = 1;
        ballPos = { ...currentField.ballStartPosition };
        gameState = 'direction';
        gameActive = true;
        shotAngle = null;

        // Initialize AI if vs_ai
        if (gameMode === 'vs_ai') {
            aiPlayer = new AIPlayer(aiDifficulty, 'right');
            aiPlayer.init(currentField);
        } else {
            aiPlayer = null;
        }

        // Configure timer
        const settings = UIManager.getSettings();
        matchTimer = settings.matchTime || 0;
        lastTimerTick = Date.now();

        // IMPORTANT: Show game screen FIRST so container has dimensions
        UIManager.showScreen('game-screen');
        UIManager.updateScore(0, 0);
        UIManager.updateTimer(matchTimer);
        UIManager.updateTurnIndicator(currentPlayer, 'direction');
        UIManager.showPowerBar(false);
        UIManager.resetPowerBar();

        // Set up renderer AFTER screen is visible (container needs dimensions)
        // Use requestAnimationFrame to ensure layout is calculated
        requestAnimationFrame(() => {
            GameRenderer.setField(currentField);
            GameRenderer.setCurrentPlayer(currentPlayer);
            GameRenderer.setBallPosition(ballPos.x, ballPos.y);

            // Set up input
            InputHandler.setBallPosition(ballPos.x, ballPos.y);
            InputHandler.setPhase('direction');

            // Play start sound
            SoundManager.init(); // Ensure context is started
            SoundManager.playStart();

            // Vibrate if supported
            if (settings.vibration && navigator.vibrate) {
                navigator.vibrate(200);
            }

            // Mark first play
            localStorage.setItem('nf_played_before', '1');

            // Start ball pulse in direction phase
            AnimationManager.setBallPulse(true);

            // Start game loop
            startGameLoop();

            // Eğer AI başlarsa (çok olası değil ama)
            checkAITurn();
        });
    }

    /**
     * Generates random nails (client-side fallback)
     * @param {Object} field
     * @returns {Array}
     */
    function generateRandomNails(field) {
        const nailCount = Math.floor(Math.random() * 21) + 15;
        const minDistance = field.nailRadius * 3;
        const nails = [];
        const centerX = field.fieldWidth / 2;
        const centerY = field.fieldHeight / 2;
        const goalTop = (field.fieldHeight - field.goalWidth) / 2;
        const goalBottom = (field.fieldHeight + field.goalWidth) / 2;
        const safeZoneRadius = field.nailRadius * 5;
        let attempts = 0;

        while (nails.length < nailCount && attempts < 1000) {
            attempts++;
            const x = Math.random() * (field.fieldWidth - field.nailRadius * 4) + field.nailRadius * 2;
            const y = Math.random() * (field.fieldHeight - field.nailRadius * 4) + field.nailRadius * 2;

            if (x < field.goalDepth + field.nailRadius * 2 && y > goalTop - field.nailRadius && y < goalBottom + field.nailRadius) continue;
            if (x > field.fieldWidth - field.goalDepth - field.nailRadius * 2 && y > goalTop - field.nailRadius && y < goalBottom + field.nailRadius) continue;

            const distToCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
            if (distToCenter < safeZoneRadius) continue;

            let tooClose = false;
            for (const nail of nails) {
                const dist = Math.sqrt((x - nail.x) ** 2 + (y - nail.y) ** 2);
                if (dist < minDistance) { tooClose = true; break; }
            }
            if (tooClose) continue;

            nails.push({ x: Math.round(x), y: Math.round(y) });
        }
        return nails;
    }

    // ═══════════════════════════════════════════
    // Oyun Döngüsü
    // ═══════════════════════════════════════════

    /**
     * Starts the game loop
     */
    function startGameLoop() {
        if (animFrameId) cancelAnimationFrame(animFrameId);

        function loop() {
            if (!gameActive) return;

            update();
            GameRenderer.render();

            animFrameId = requestAnimationFrame(loop);
        }
        animFrameId = requestAnimationFrame(loop);
    }

    /**
     * Main update function (called every frame)
     */
    function update() {
        // Update animations
        AnimationManager.update();
        EffectsManager.update();

        // Timer
        if (matchTimer > 0 && gameState !== 'gameover') {
            const now = Date.now();
            if (now - lastTimerTick >= 1000) {
                matchTimer--;
                lastTimerTick = now;
                UIManager.updateTimer(matchTimer);

                if (matchTimer <= 0) {
                    endGame();
                    return;
                }
            }
        }

        // Power bar animation
        if (gameState === 'power') {
            const settings = UIManager.getSettings();
            const speed = settings.powerBarSpeed / 60; // Per frame
            powerValue += powerDirection * speed;

            if (powerValue >= 1) {
                powerValue = 1;
                powerDirection = -1;
            } else if (powerValue <= 0) {
                powerValue = 0;
                powerDirection = 1;
            }

            UIManager.updatePowerBar(powerValue);
        }

        // Ball animation playback
        if (gameState === 'animating') {
            // Deterministic slow-motion frame control
            const shouldAdvance = EffectsManager.shouldAdvanceFrame();

            if (shouldAdvance) {
                const prevX = ballPos.x;
                const prevY = ballPos.y;
                const pos = PhysicsClient.advancePlayback();
                if (pos) {
                    ballPos.x = pos.x;
                    ballPos.y = pos.y;
                    GameRenderer.setBallPosition(ballPos.x, ballPos.y);

                    // Calculate speed from frame delta
                    const dx = ballPos.x - prevX;
                    const dy = ballPos.y - prevY;
                    const speed = Math.sqrt(dx * dx + dy * dy);

                    // Update effects with speed
                    EffectsManager.updateTrail(ballPos.x, ballPos.y, speed);
                    EffectsManager.updateBallGlow(speed);

                    // Check near-miss
                    const field = GameRenderer.getField();
                    EffectsManager.checkNearMiss(ballPos.x, ballPos.y, field);
                }
            }
            // Playback complete is handled by callback
        } else {
            EffectsManager.clearTrail();
            EffectsManager.updateBallGlow(0);
        }
    }

    // ═══════════════════════════════════════════
    // Girdi İşleme
    // ═══════════════════════════════════════════

    /**
     * Handles direction change from input
     * @param {number} angle
     */
    function handleDirectionChange(angle) {
        if (gameState !== 'direction') return;
        shotAngle = angle;
        GameRenderer.setDirectionArrow(angle);
    }

    /**
     * Handles direction confirmation
     * @param {number} angle
     */
    function handleDirectionConfirm(angle) {
        if (gameState !== 'direction') return;
        shotAngle = angle;
        GameRenderer.setDirectionArrow(angle);

        SoundManager.playClick();
        AnimationManager.setBallPulse(false);

        // Move to power phase
        gameState = 'power';
        powerValue = 0;
        powerDirection = 1;
        InputHandler.setPhase('power');
        UIManager.showPowerBar(true);
        UIManager.updateTurnIndicator(currentPlayer, 'power');
    }

    /**
     * Handles power lock from input
     */
    function handlePowerLock() {
        if (gameState !== 'power') return;

        SoundManager.playClick();
        UIManager.lockPowerBar(powerValue);

        // Execute shot
        executeShot(shotAngle, powerValue);
    }

    /**
     * Executes a shot
     * @param {number} angle
     * @param {number} power
     */
    function executeShot(angle, power) {
        gameState = 'animating';
        InputHandler.setPhase('animating');
        GameRenderer.setDirectionArrow(null);
        UIManager.showPowerBar(false);
        UIManager.updateTurnIndicator(currentPlayer, 'animating');

        // Play kick sound
        SoundManager.playKick(power);

        if (gameMode === 'local' || gameMode === 'vs_ai') {
            // Apply friction setting override
            const settings = UIManager.getSettings();
            if (settings.friction) currentField.friction = settings.friction;
            // Simulate locally
            const result = PhysicsClient.simulateShot(currentField, angle, power, ballPos);

            // Start playback
            PhysicsClient.startPlayback(result, handleCollisionEvent, handleShotComplete);
        } else {
            // Send to server
            NetworkManager.shoot(angle, power);
        }
    }

    /**
     * Handles collision events during playback
     * @param {Object} event
     */
    function handleCollisionEvent(event) {
        // Calculate speed from trajectory context
        const speed = event.speed || 5; // Default moderate speed

        if (event.type === 'nail') {
            EffectsManager.playHitSound('nail', speed);
            AnimationManager.triggerNailGlow(event.index);
            EffectsManager.triggerSparks(event.x, event.y, speed);
            EffectsManager.triggerShake(speed);

            const settings = UIManager.getSettings();
            if (settings.particles) {
                AnimationManager.spawnParticles(event.x, event.y, '#C0C0C0', 3, 2, 15);
            }
        } else if (event.type === 'wall') {
            EffectsManager.playHitSound('wall', speed);
            EffectsManager.triggerShake(speed * 0.6);

            const settings = UIManager.getSettings();
            if (settings.particles) {
                AnimationManager.spawnParticles(event.x, event.y, '#8892b0', 2, 1.5, 10);
            }
        }
    }

    /**
     * Handles shot completion
     * @param {Object|null} goalScored
     */
    function handleShotComplete(goalScored) {
        if (goalScored) {
            // Determine who benefits from the goal
            // P1 defends LEFT goal, P2 defends RIGHT goal
            // Left goal scored → P2 gets the point (whether P1 scored or P2 own-goaled)
            // Right goal scored → P1 gets the point
            let scorer;
            if (goalScored.side === 'right') {
                // Sağ kaleye gol → P1'in golü (P2'nin kalesi)
                scorer = 1;
            } else {
                // Sol kaleye gol → P2'nin golü (P1'in kalesi)
                scorer = 2;
            }

            // Own goal detection for UI feedback
            const isOwnGoal = (scorer === currentPlayer)
                ? false  // Normal goal
                : false; // Not own goal if it's the opponent's benefit
            // Actually: if kicker scored into their OWN defended goal, it's an own goal
            const kickerDefendsLeft = (currentPlayer === 1);
            const scoredInLeft = (goalScored.side === 'left');
            const ownGoal = (kickerDefendsLeft && scoredInLeft) || (!kickerDefendsLeft && !scoredInLeft);

            gameState = 'goal';
            scores[scorer - 1]++;
            UIManager.updateScore(scores[0], scores[1]);
            AnimationManager.triggerScoreBounce(scorer);

            // Sound and animation
            SoundManager.playGoal();
            const goalX = goalScored.side === 'right' ? currentField.fieldWidth - 15 : 15;
            const goalY = currentField.fieldHeight / 2;
            AnimationManager.triggerGoalAnimation(scorer, goalX, goalY);

            // Goal effects: slow-mo and net rip
            EffectsManager.triggerSlowMo(45, 0.3);
            EffectsManager.triggerNetRip(goalScored.side, currentField.fieldWidth, currentField.fieldHeight);

            // Update turn indicator with own goal info
            if (ownGoal) {
                UIManager.updateTurnIndicator(currentPlayer, 'owngoal');
            }

            // AI Reaction for Goal
            if (gameMode === 'vs_ai' && aiPlayer) {
                const aiScored = (scorer === (aiPlayer.side === 'left' ? 1 : 2));
                const event = aiScored ? 'score_goal' : 'concede_goal';
                const quote = aiPlayer.personality.getQuote(event);
                setTimeout(() => {
                    UIManager.showAIMessage(quote, aiPlayer.personality.data.emoji, 4000);
                }, 1000); // Biraz gecikmeli göster
            }

            // Vibrate
            const settings = UIManager.getSettings();
            if (settings.vibration && navigator.vibrate) {
                navigator.vibrate([100, 50, 200]);
            }

            // Check goal limit
            const goalLimit = settings.goalLimit;
            if (goalLimit > 0 && (scores[0] >= goalLimit || scores[1] >= goalLimit)) {
                setTimeout(() => endGame(), 2500);
                return;
            }

            // Reset ball after delay
            setTimeout(() => {
                if (gameState === 'gameover') return;
                ballPos = { ...currentField.ballStartPosition };
                GameRenderer.setBallPosition(ballPos.x, ballPos.y);
                InputHandler.setBallPosition(ballPos.x, ballPos.y);
                nextTurn();
            }, 2500);
        } else {
            // No goal, switch turns
            nextTurn();
        }
    }

    /**
     * Switches to the next player's turn
     */
    function nextTurn() {
        currentPlayer = currentPlayer === 1 ? 2 : 1;
        gameState = 'direction';
        shotAngle = null;

        GameRenderer.setCurrentPlayer(currentPlayer);
        InputHandler.setPhase('direction');
        InputHandler.setBallPosition(ballPos.x, ballPos.y);
        GameRenderer.setDirectionArrow(null);
        UIManager.updateTurnIndicator(currentPlayer, 'direction');
        UIManager.resetPowerBar();
        AnimationManager.setBallPulse(true);

        SoundManager.playTurnChange();

        const settings = UIManager.getSettings();
        if (settings.vibration && navigator.vibrate) {
            navigator.vibrate(50);
        }

        checkAITurn();
    }

    /**
     * Checks if it's the AI's turn and triggers it
     */
    function checkAITurn() {
        console.log("[DEBUG] checkAITurn called.", { gameMode, currentPlayer, hasAiPlayer: !!aiPlayer });
        if (gameMode === 'vs_ai' && aiPlayer && aiPlayer.getPlayerSide() === (currentPlayer === 1 ? 'left' : 'right')) {
            console.log("[DEBUG] AI Turn Condition Met! Changing phase and scheduling AI...");
            // Disable player input
            InputHandler.setPhase('idle');
            UIManager.updateTurnIndicator(currentPlayer, 'waiting');

            // Timeout ensures UI updates before heavy simulation blocks thread
            setTimeout(async () => {
                try {
                    const aiGameState = {
                        ball: ballPos,
                        field: currentField,
                        scores: scores
                    };
                    const shot = await aiPlayer.takeTurn(aiGameState);
                    if (shot && shot.angle !== undefined && shot.power !== undefined) {
                        executeShot(shot.angle, shot.power);
                    } else {
                        console.error("[ERROR] AI failed to decide a shot.", shot);
                        nextTurn(); // Fallback if AI fails
                    }
                } catch (err) {
                    console.error("[ERROR] AI execution failed:", err);
                    nextTurn();
                }
            }, 100);
        }
    }

    /**
     * Ends the game
     */
    function endGame() {
        gameState = 'gameover';
        gameActive = false;
        InputHandler.setPhase('idle');
        AnimationManager.setBallPulse(false);

        SoundManager.playEnd();

        let winner = 0;
        if (scores[0] > scores[1]) winner = 1;
        else if (scores[1] > scores[0]) winner = 2;

        UIManager.showGameOver(winner, scores[0], scores[1]);
        console.log(`[INFO] Oyun bitti! Skor: ${scores[0]} - ${scores[1]}`);

        // AI Reaction for Game Over
        if (gameMode === 'vs_ai' && aiPlayer && winner !== 0) {
            const aiWon = (winner === (aiPlayer.side === 'left' ? 1 : 2));
            const playerWon = !aiWon;

            // Reaksiyon göster
            const event = aiWon ? 'win' : 'loss';
            const quote = aiPlayer.personality.getQuote(event);
            setTimeout(() => {
                UIManager.showAIMessage(quote, aiPlayer.personality.data.emoji, 5000);
            }, 500);

            // İstatistik Kaydet 
            let aiStats = { wins: 0, matches: 0 };
            const aiStatsStr = localStorage.getItem('nf_ai_stats');
            if (aiStatsStr) {
                try { aiStats = JSON.parse(aiStatsStr); } catch (e) { }
            }
            aiStats.matches += 1;
            if (playerWon) aiStats.wins += 1; // User winning vs AI
            localStorage.setItem('nf_ai_stats', JSON.stringify(aiStats));
        }

        // Record match result to server
        if (typeof AuthManager !== 'undefined' && AuthManager.isLoggedIn() && gameMode === 'multiplayer') {
            const settings = UIManager.getSettings();
            NetworkManager.send({
                type: 'MATCH_RESULT',
                data: {
                    player1: { username: AuthManager.getUsername(), score: scores[0] },
                    player2: { username: 'Rakip', score: scores[1] },
                    fieldId: currentField ? currentField.id : 'classic_442',
                    goalLimit: settings.goalLimit || 5,
                    totalShots: 0
                }
            });
        }
    }

    /**
     * Restarts the game with the same field
     */
    function restart() {
        if (currentField) {
            AnimationManager.clearAll();
            scores = [0, 0];
            currentPlayer = 1;
            ballPos = { ...currentField.ballStartPosition };
            gameState = 'direction';
            gameActive = true;
            shotAngle = null;

            const settings = UIManager.getSettings();
            matchTimer = settings.matchTime || 0;
            lastTimerTick = Date.now();

            GameRenderer.setBallPosition(ballPos.x, ballPos.y);
            InputHandler.setBallPosition(ballPos.x, ballPos.y);
            InputHandler.setPhase('direction');

            UIManager.updateScore(0, 0);
            UIManager.updateTimer(matchTimer);
            UIManager.updateTurnIndicator(currentPlayer, 'direction');
            UIManager.resetPowerBar();
            UIManager.showPowerBar(false);

            AnimationManager.setBallPulse(true);
            SoundManager.playStart();
            startGameLoop();
        }
    }

    /**
     * Stops the current game
     */
    function stop() {
        gameActive = false;
        gameState = 'idle';
        if (animFrameId) {
            cancelAnimationFrame(animFrameId);
            animFrameId = null;
        }
        AnimationManager.clearAll();
        InputHandler.setPhase('idle');
        NetworkManager.disconnect();
        aiPlayer = null; // Reset AI on stop
    }

    // ═══════════════════════════════════════════
    // Ağ Mesajları
    // ═══════════════════════════════════════════

    /**
     * Processes a turn change (called directly or after animation)
     * @param {Object} data
     */
    function processTurnChange(data) {
        currentPlayer = data.currentPlayer;
        ballPos = { ...data.ballPosition };
        GameRenderer.setBallPosition(ballPos.x, ballPos.y);
        GameRenderer.setCurrentPlayer(currentPlayer);
        InputHandler.setBallPosition(ballPos.x, ballPos.y);

        const myId = NetworkManager.getPlayerId();
        if (currentPlayer === myId) {
            gameState = 'direction';
            InputHandler.setPhase('direction');
        } else {
            gameState = 'idle';
            InputHandler.setPhase('idle');
        }
        UIManager.updateTurnIndicator(currentPlayer,
            currentPlayer === myId ? 'direction' : 'waiting'
        );
        UIManager.resetPowerBar();
        AnimationManager.setBallPulse(true);
        SoundManager.playTurnChange();
    }

    /**
     * Processes a goal scored event (called directly or after animation)
     * @param {Object} data
     */
    function processGoalScored(data) {
        scores = data.scores;
        UIManager.updateScore(scores[0], scores[1]);
        SoundManager.playGoal();
        if (typeof AnimationManager.triggerScoreBounce === 'function') {
            AnimationManager.triggerScoreBounce(data.scoringPlayer);
        }
        if (currentField) {
            AnimationManager.triggerGoalAnimation(data.scoringPlayer,
                data.scoringPlayer === 1 ? currentField.fieldWidth - 15 : 15,
                currentField.fieldHeight / 2
            );
        }
        // Ball reset and state transition handled by delayed TURN_CHANGE
    }

    /**
     * Handles incoming network messages
     * @param {Object} data
     */
    function handleNetworkMessage(data) {
        switch (data.type) {
            case 'ROOM_CREATED':
                UIManager.setLobbyStatus(
                    `Oda kodu: ${data.roomCode} - Oyuncu bekleniyor...`,
                    'waiting'
                );
                break;

            case 'ROOM_JOINED':
                UIManager.setLobbyStatus(
                    `${data.hostName} odasına katıldın!`,
                    'success'
                );
                break;

            case 'PLAYER_JOINED':
                UIManager.setLobbyStatus(
                    `${data.playerName} katıldı! Saha seçimi yapılıyor...`,
                    'success'
                );
                break;

            case 'FIELD_LIST':
                // Both host and joiner receive this - show field select
                UIManager.showFieldSelectWithFields(data.fields, gameMode);
                break;

            case 'FIELD_SELECTED':
                if (data.fieldData) {
                    currentField = data.fieldData;
                }
                break;

            case 'GAME_START':
                if (currentField) {
                    scores = data.initialState.scores;
                    currentPlayer = data.initialState.currentPlayer;
                    ballPos = { ...data.initialState.ballPosition };
                    gameState = 'direction';
                    gameActive = true;
                    shotAngle = null;

                    // Configure timer
                    const mpSettings = UIManager.getSettings();
                    matchTimer = mpSettings.matchTime || 0;
                    lastTimerTick = Date.now();

                    // IMPORTANT: Show game screen FIRST so container has dimensions
                    UIManager.showScreen('game-screen');
                    UIManager.updateScore(scores[0], scores[1]);
                    UIManager.updateTimer(matchTimer);
                    UIManager.showPowerBar(false);
                    UIManager.resetPowerBar();

                    const myId = NetworkManager.getPlayerId();
                    UIManager.updateTurnIndicator(currentPlayer,
                        currentPlayer === myId ? 'direction' : 'waiting'
                    );

                    // Set up renderer AFTER screen is visible (container needs dimensions)
                    // Use setTimeout to ensure CSS transition and layout are fully applied
                    setTimeout(() => {
                        requestAnimationFrame(() => {
                            GameRenderer.setField(currentField);
                            GameRenderer.setCurrentPlayer(currentPlayer);
                            GameRenderer.setBallPosition(ballPos.x, ballPos.y);

                            InputHandler.setBallPosition(ballPos.x, ballPos.y);
                            if (currentPlayer === myId) {
                                InputHandler.setPhase('direction');
                            } else {
                                InputHandler.setPhase('idle');
                            }

                            SoundManager.init();
                            SoundManager.playStart();
                            AnimationManager.setBallPulse(true);

                            startGameLoop();
                        });
                    }, 100);
                }
                break;

            case 'SHOT_EXECUTED':
                if (data.trajectory) {
                    gameState = 'animating';
                    InputHandler.setPhase('animating');
                    GameRenderer.setDirectionArrow(null);
                    UIManager.showPowerBar(false);
                    UIManager.updateTurnIndicator(currentPlayer, 'animating');
                    AnimationManager.setBallPulse(false);

                    PhysicsClient.startPlayback(
                        { trajectory: data.trajectory, collisionEvents: data.collisionEvents || [], goalScored: null },
                        handleCollisionEvent,
                        () => {
                            // Playback complete - process any pending messages
                            if (pendingGoalScored) {
                                processGoalScored(pendingGoalScored);
                                pendingGoalScored = null;
                                // Delay turn change to let goal animation play
                                if (pendingTurnChange) {
                                    const turnData = pendingTurnChange;
                                    pendingTurnChange = null;
                                    setTimeout(() => {
                                        processTurnChange(turnData);
                                    }, 2500);
                                }
                            } else if (pendingTurnChange) {
                                processTurnChange(pendingTurnChange);
                                pendingTurnChange = null;
                            }
                        }
                    );
                }
                break;

            case 'TURN_CHANGE':
                if (gameState === 'animating' && PhysicsClient.isPlaying()) {
                    // Queue this message until playback completes
                    pendingTurnChange = data;
                } else {
                    processTurnChange(data);
                }
                break;

            case 'GOAL_SCORED':
                if (gameState === 'animating' && PhysicsClient.isPlaying()) {
                    // Queue this message until playback completes
                    pendingGoalScored = data;
                } else {
                    processGoalScored(data);
                }
                break;

            case 'GAME_OVER':
                scores = data.finalScores;
                UIManager.updateScore(scores[0], scores[1]);
                endGame();
                break;

            case 'PLAYER_DISCONNECTED':
                UIManager.setLobbyStatus(
                    `Oyuncu ${data.playerId} bağlantısı koptu. Yeniden bağlanma bekleniyor...`,
                    'waiting'
                );
                break;

            case 'GAME_CANCELLED':
                UIManager.showConfirmDialog(
                    `Oyun iptal edildi: ${data.reason}`,
                    () => {
                        stop();
                        UIManager.showScreen('main-menu');
                    }
                );
                break;

            case 'ERROR':
                UIManager.setLobbyStatus(data.message, 'error');
                break;

            // Auth messages
            case 'AUTH_SUCCESS':
                if (typeof AuthManager !== 'undefined') {
                    AuthManager.handleAuthSuccess(data);
                    UIManager.showScreen('main-menu');
                }
                break;

            case 'AUTH_ERROR':
                if (typeof AuthManager !== 'undefined') {
                    AuthManager.handleAuthError(data.message);
                }
                break;

            case 'ELO_UPDATE':
                console.log('[ELO] Rating değişimi:', data.eloChanges);
                if (typeof UIManager !== 'undefined' && UIManager.showGameOverElo) {
                    UIManager.showGameOverElo(data.eloChanges);
                }
                break;

            // Tournament messages
            case 'TOURNAMENT_CREATED':
                if (typeof UIManager !== 'undefined') UIManager.showNotification(`🏆 Yeni turnuva: ${data.tournament.name}`);
            case 'TOURNAMENT_UPDATED':
                if (typeof TournamentUI !== 'undefined') TournamentUI.handleTournamentUpdate(data.tournament);
                break;

            case 'TOURNAMENT_STARTED':
                if (typeof UIManager !== 'undefined') UIManager.showNotification(`🔥 Turnuva başladı: ${data.tournament.name}`);
                if (typeof TournamentUI !== 'undefined') TournamentUI.handleTournamentStarted(data.tournament);
                break;

            case 'TOURNAMENT_ERROR':
                if (typeof TournamentUI !== 'undefined') TournamentUI.handleTournamentError(data.message);
                break;

            case 'TOURNAMENT_LIST':
                // handled by rest api
                break;
        }
    }

    /**
     * Handles network status changes
     * @param {string} status
     */
    function handleNetworkStatus(status) {
        switch (status) {
            case 'connected':
                console.log('[INFO] Sunucuya bağlandı');
                // Auto-login with token if available
                if (typeof AuthManager !== 'undefined' && AuthManager.hasToken()) {
                    AuthManager.loginWithToken();
                }
                break;
            case 'disconnected':
                console.log('[INFO] Sunucu bağlantısı kesildi');
                break;
            case 'error':
                UIManager.setLobbyStatus('Bağlantı hatası!', 'error');
                break;
        }
    }

    return {
        init,
        setMode,
        getMode: () => gameMode,
        setAIDifficulty,
        startGame,
        restart,
        stop
    };
})();

// ═══════════════════════════════════════════
// Uygulama Başlatma
// ═══════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    Game.init();
});
