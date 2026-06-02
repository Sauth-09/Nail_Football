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

        // Connect to server immediately to trigger auto-login and online tracking
        if (typeof NetworkManager !== 'undefined') {
            NetworkManager.connect();
        }

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

        // Sync team manager with UI dropdowns to ensure previous selections are preserved
        if (typeof TeamManager !== 'undefined') {
            const selectP1 = document.getElementById('team-select-p1');
            const selectP2 = document.getElementById('team-select-p2');
            if (selectP1) TeamManager.selectTeam(1, selectP1.value || null);
            if (selectP2) TeamManager.selectTeam(2, selectP2.value || null);
        }

        // Reset jokers for new game
        if (typeof JokerManager !== 'undefined') JokerManager.resetJokers();

        // Initialize AI if vs_ai
        if (gameMode === 'vs_ai') {
            aiPlayer = new AIPlayer(aiDifficulty, 'right');
            aiPlayer.init(currentField);

            // Auto-assign teams if not selected to ensure anthems play and fans render nicely
            if (typeof TeamManager !== 'undefined') {
                // If Player 1 (user) hasn't selected a team, assign a default one
                if (!TeamManager.getTeamId(1)) {
                    TeamManager.selectTeam(1, 'galatasaray');
                    const selectP1 = document.getElementById('team-select-p1');
                    if (selectP1) selectP1.value = 'galatasaray';
                }

                // If Player 2 (AI) hasn't selected a team, assign based on difficulty
                if (!TeamManager.getTeamId(2)) {
                    let aiTeam = 'fenerbahce';
                    if (aiDifficulty === 'medium') aiTeam = 'besiktas';
                    else if (aiDifficulty === 'hard') aiTeam = 'trabzonspor';

                    // Ensure AI team doesn't conflict with Player 1's team
                    if (TeamManager.getTeamId(1) === aiTeam) {
                        aiTeam = aiTeam === 'fenerbahce' ? 'besiktas' : 'fenerbahce';
                    }

                    TeamManager.selectTeam(2, aiTeam);
                    const selectP2 = document.getElementById('team-select-p2');
                    if (selectP2) selectP2.value = aiTeam;
                }
            }
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

            // Initialize fans based on team selection
            if (typeof FansRenderer !== 'undefined' && typeof TeamManager !== 'undefined') {
                const team1 = TeamManager.getTeam(1);
                const team2 = TeamManager.getTeam(2);
                FansRenderer.init(team1, team2);
            }

            // Show joker buttons if available
            if (typeof JokerManager !== 'undefined') {
                UIManager.showJokerButtons(currentPlayer);
            }

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

        const shotStartTime = Date.now();
        const settings = UIManager.getSettings();

        if (gameMode === 'local' || gameMode === 'vs_ai') {
            // Apply friction setting override
            if (settings.friction) currentField.friction = settings.friction;

            // Get joker options if active
            const jokerOptions = (typeof JokerManager !== 'undefined') ? JokerManager.getJokerShotOptions() : {};

            const options = {
                goalkeeperEnabled: settings.goalkeeperEnabled,
                goalkeeperSize: settings.goalkeeperSize || 30,
                shotStartTime: shotStartTime,
                jokerOptions: jokerOptions
            };

            // Inform renderer (including frozen state for visual sync)
            const isGkFrozen = jokerOptions.freezeGoalkeeper === true;
            GameRenderer.setGoalkeeperState(options.goalkeeperEnabled, shotStartTime, isGkFrozen, jokerOptions.frozenY);

            // Simulate locally
            const result = PhysicsClient.simulateShot(currentField, angle, power, ballPos, options);

            // Start playback
            PhysicsClient.startPlayback(result, handleCollisionEvent, handleShotComplete);
        } else {
            // Inform renderer (optimistically, though GAME_START already set it, this is safe)
            // Wait, we use room setting for multiplayer. We'll rely on what we store locally?
            // Actually, for multiplayer, goalkeeper setting should be set at GAME_START.
            // But we can just use UIManager.getSettings().goalkeeperEnabled assuming it's synced.

            // Send to server
            NetworkManager.shoot(angle, power, shotStartTime);
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
        } else if (event.type === 'goalkeeper') {
            EffectsManager.playHitSound('goalkeeper', speed);
            EffectsManager.triggerSparks(event.x, event.y, speed * 1.5);
            EffectsManager.triggerShake(speed * 0.8);

            const settings = UIManager.getSettings();
            if (settings.particles) {
                AnimationManager.spawnParticles(event.x, event.y, '#E0E0E0', 4, 2.5, 12);
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
            const scorerTeamId = (typeof TeamManager !== 'undefined') ? TeamManager.getTeamId(scorer) : null;
            SoundManager.playGoal(scorerTeamId);
            const goalX = goalScored.side === 'right' ? currentField.fieldWidth - 15 : 15;
            const goalY = currentField.fieldHeight / 2;
            AnimationManager.triggerGoalAnimation(scorer, goalX, goalY);

            // Fans celebration
            if (typeof FansRenderer !== 'undefined') {
                FansRenderer.onGoal(scorer);
            }

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

        if (typeof JokerManager !== 'undefined') {
            JokerManager.clearActiveJoker();

            // Restore temporarily removed nail (from destroyNail joker)
            if (JokerManager.getRemovedNail() && currentField) {
                JokerManager.restoreRemovedNail(currentField);
                // Rebuild field visuals to show the restored nail
                GameRenderer.setField(currentField);
                GameRenderer.setBallPosition(ballPos.x, ballPos.y);
            }

            const settings = typeof UIManager !== 'undefined' ? UIManager.getSettings() : { goalkeeperEnabled: true };
            GameRenderer.setGoalkeeperState(settings.goalkeeperEnabled, 0, false);
        }

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

        // Update joker buttons
        if (typeof JokerManager !== 'undefined') {
            UIManager.showJokerButtons(currentPlayer);
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
                        scores: scores,
                        options: {
                            goalkeeperEnabled: UIManager.getSettings().goalkeeperEnabled,
                            goalkeeperSize: UIManager.getSettings().goalkeeperSize
                        }
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

        if (typeof JokerManager !== 'undefined') {
            // Restore temporarily removed nail before clearing joker state
            if (JokerManager.getRemovedNail() && currentField) {
                JokerManager.restoreRemovedNail(currentField);
                GameRenderer.setField(currentField);
            }

            JokerManager.clearActiveJoker();
            const settings = typeof UIManager !== 'undefined' ? UIManager.getSettings() : { goalkeeperEnabled: true };
            GameRenderer.setGoalkeeperState(settings.goalkeeperEnabled, 0, false);
        }

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

            // Reset jokers
            if (typeof JokerManager !== 'undefined') {
                JokerManager.resetJokers();
                const settings = typeof UIManager !== 'undefined' ? UIManager.getSettings() : { goalkeeperEnabled: true };
                GameRenderer.setGoalkeeperState(settings.goalkeeperEnabled, 0, false);
            }

            // Reset fans
            if (typeof FansRenderer !== 'undefined') FansRenderer.reset();

            // Stop any playing anthems on restart
            if (typeof SoundManager !== 'undefined') SoundManager.stopActiveAnthem();

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

        // Clean up fans
        if (typeof FansRenderer !== 'undefined') FansRenderer.destroy();

        // Stop any active anthem on stop
        if (typeof SoundManager !== 'undefined') SoundManager.stopActiveAnthem();

        // Reset team selection
        if (typeof TeamManager !== 'undefined') TeamManager.resetSelection();
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
        const scorerTeamId = (typeof TeamManager !== 'undefined') ? TeamManager.getTeamId(data.scoringPlayer) : null;
        SoundManager.playGoal(scorerTeamId);
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
                    console.log(`[MAIN] FIELD_SELECTED received - fieldId: ${data.fieldId}, fieldWidth: ${data.fieldData.fieldWidth}`);
                } else {
                    console.warn('[MAIN] FIELD_SELECTED received but fieldData is null/undefined!');
                }
                break;

            case 'GAME_START':
                console.log(`[MAIN] GAME_START received - currentField: ${currentField ? 'SET' : 'NULL'}, hasFieldData: ${!!data.fieldData}`);
                // Ensure currentField is set (FIELD_SELECTED should have arrived first)
                if (!currentField && data.fieldData) {
                    // Fallback: use fieldData from GAME_START if FIELD_SELECTED was missed
                    currentField = data.fieldData;
                    console.log('[MAIN] currentField was null, using fallback from GAME_START');
                }
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

                    // Update UI settings based on room config if provided
                    if (data.goalkeeperEnabled !== undefined) {
                        GameRenderer.setGoalkeeperState(data.goalkeeperEnabled, 0);
                        // Save to local UI so that if user checks settings, it matches
                        mpSettings.goalkeeperEnabled = data.goalkeeperEnabled;
                    }

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

                    // UPDATE GOALKEEPER STATE
                    const settings = typeof UIManager !== 'undefined' ? UIManager.getSettings() : { goalkeeperEnabled: true };
                    GameRenderer.setGoalkeeperState(
                        settings.goalkeeperEnabled, 
                        data.shotStartTime || Date.now(), 
                        false, // isGkFrozen (not synced yet for MP jokers, but false is fine)
                        null
                    );

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

            case 'SPECTATE_JOINED':
                gameMode = 'spectator';
                currentField = data.gameState.fieldConfig;
                scores = data.gameState.scores || [0, 0];
                currentPlayer = data.gameState.currentPlayer || 1;
                ballPos = data.gameState.ballPosition ? { ...data.gameState.ballPosition } : { ...currentField.ballStartPosition };
                gameActive = true;
                gameState = 'idle';

                UIManager.showScreen('game-screen');
                UIManager.updateScore(scores[0], scores[1]);
                UIManager.updateTurnIndicator(currentPlayer, 'waiting');
                UIManager.showPowerBar(false);
                UIManager.showNotification('📺 İzleyici Moduna Geçildi');

                setTimeout(() => {
                    requestAnimationFrame(() => {
                        GameRenderer.setField(currentField);
                        GameRenderer.setCurrentPlayer(currentPlayer);
                        GameRenderer.setBallPosition(ballPos.x, ballPos.y);
                        InputHandler.setPhase('idle');
                        startGameLoop();
                    });
                }, 100);
                break;

            case 'SPECTATE_ERROR':
                UIManager.showNotification(data.message || 'Maça katılınamadı');
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

            // ── Friend System Messages ──
            case 'FRIEND_LIST':
            case 'FRIEND_PENDING_LIST':
            case 'FRIEND_SEARCH_RESULT':
            case 'FRIEND_REQUEST_SENT':
            case 'FRIEND_REQUEST_RECEIVED':
            case 'FRIEND_REQUEST_ACCEPTED':
            case 'FRIEND_REQUEST_DECLINED':
            case 'FRIEND_REMOVED':
            case 'FRIEND_BLOCKED':
            case 'FRIEND_UNBLOCKED':
            case 'FRIEND_ERROR':
            case 'FRIEND_STATUS_CHANGED':
                if (typeof FriendsManager !== 'undefined') {
                    FriendsManager.handleMessage(data);
                }
                break;

            // ── Game Challenge Messages ──
            case 'GAME_CHALLENGE_SENT':
            case 'GAME_CHALLENGE_RECEIVED':
            case 'GAME_CHALLENGE_ACCEPTED':
            case 'GAME_CHALLENGE_DECLINED':
            case 'GAME_CHALLENGE_EXPIRED':
            case 'GAME_CHALLENGE_CANCELLED':
            case 'GAME_CHALLENGE_ERROR':
                if (typeof ChallengeUI !== 'undefined') {
                    ChallengeUI.handleMessage(data);
                }
                break;

            case 'GLOBAL_STATS':
                const onlineBadge = document.getElementById('global-online-badge');
                if (onlineBadge && data.stats) {
                    onlineBadge.textContent = '🟢 Aktif Oyuncu: ' + (data.stats.onlinePlayers || 0);
                }
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
        stop,
        // Exposed for joker nail-select mode
        getCurrentField: () => currentField,
        getCurrentPlayer: () => currentPlayer,
        getGameState: () => gameState,
        getBallPos: () => ballPos
    };
})();

// ═══════════════════════════════════════════
// Uygulama Başlatma
// ═══════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    Game.init();
});
