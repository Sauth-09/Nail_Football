/**
 * animationManager.js - Vuruş, Gol ve Çarpışma Animasyonları
 * 
 * Parçacık sistemi, ekran sarsıntısı, gol animasyonu,
 * çivi parlama efekti ve sıra değişimi animasyonları.
 * Object pooling ile optimize edilmiştir.
 */

'use strict';

const AnimationManager = (() => {

    // ═══════════════════════════════════════════
    // Parçacık Sistemi (Object Pool)
    // ═══════════════════════════════════════════

    /** @constant {number} Maximum particles in pool */
    const MAX_PARTICLES = 200;

    /** @type {Array<Object>} Particle pool */
    const particlePool = [];

    /** @type {Array<Object>} Active particles */
    const activeParticles = [];

    // Pre-fill pool
    for (let i = 0; i < MAX_PARTICLES; i++) {
        particlePool.push({
            x: 0, y: 0, vx: 0, vy: 0,
            life: 0, maxLife: 0,
            size: 0, color: '#ffffff',
            active: false
        });
    }

    /**
     * Gets a particle from the pool
     * @returns {Object|null} Particle object or null if pool is empty
     */
    function getParticle() {
        for (const p of particlePool) {
            if (!p.active) {
                p.active = true;
                activeParticles.push(p);
                return p;
            }
        }
        return null;
    }

    /**
     * Spawns particles at a position
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {string} color - Particle color
     * @param {number} count - Number of particles
     * @param {number} speed - Particle speed
     * @param {number} life - Particle lifetime in frames
     */
    function spawnParticles(x, y, color, count = 8, speed = 3, life = 30) {
        for (let i = 0; i < count; i++) {
            const p = getParticle();
            if (!p) break;
            const angle = Math.random() * Math.PI * 2;
            const spd = speed * (0.5 + Math.random() * 0.5);
            p.x = x;
            p.y = y;
            p.vx = Math.cos(angle) * spd;
            p.vy = Math.sin(angle) * spd;
            p.life = life;
            p.maxLife = life;
            p.size = 2 + Math.random() * 3;
            p.color = color;
        }
    }

    /**
     * Updates all active particles
     */
    function updateParticles() {
        for (let i = activeParticles.length - 1; i >= 0; i--) {
            const p = activeParticles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.1; // Gravity
            p.life--;

            if (p.life <= 0) {
                p.active = false;
                activeParticles.splice(i, 1);
            }
        }
    }

    /**
     * Draws all active particles
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} offsetX - Canvas offset X
     * @param {number} offsetY - Canvas offset Y
     * @param {number} scale - Scale factor
     */
    function drawParticles(ctx, offsetX = 0, offsetY = 0, scale = 1) {
        for (const p of activeParticles) {
            const alpha = p.life / p.maxLife;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(
                offsetX + p.x * scale,
                offsetY + p.y * scale,
                p.size * scale * alpha,
                0, Math.PI * 2
            );
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // ═══════════════════════════════════════════
    // Ekran Sarsıntısı
    // ═══════════════════════════════════════════

    /** @type {Object} Screen shake state */
    const shake = {
        active: false,
        intensity: 0,
        duration: 0,
        timer: 0,
        offsetX: 0,
        offsetY: 0
    };

    /**
     * Starts a screen shake effect
     * @param {number} intensity - Shake intensity in pixels
     * @param {number} duration - Duration in frames
     */
    function startShake(intensity = 3, duration = 18) {
        shake.active = true;
        shake.intensity = intensity;
        shake.duration = duration;
        shake.timer = duration;
    }

    /**
     * Updates screen shake
     */
    function updateShake() {
        if (!shake.active) return;
        shake.timer--;
        if (shake.timer <= 0) {
            shake.active = false;
            shake.offsetX = 0;
            shake.offsetY = 0;
            return;
        }
        const progress = shake.timer / shake.duration;
        const current = shake.intensity * progress;
        shake.offsetX = (Math.random() - 0.5) * 2 * current;
        shake.offsetY = (Math.random() - 0.5) * 2 * current;
    }

    /**
     * Gets current shake offset
     * @returns {{x: number, y: number}}
     */
    function getShakeOffset() {
        return { x: shake.offsetX, y: shake.offsetY };
    }

    // ═══════════════════════════════════════════
    // Çivi Parlama Efekti
    // ═══════════════════════════════════════════

    /** @type {Map<number, number>} Nail index → remaining glow frames */
    const nailGlows = new Map();

    /**
     * Triggers a nail glow effect
     * @param {number} nailIndex - Index of the nail to glow
     * @param {number} duration - Glow duration in frames
     */
    function triggerNailGlow(nailIndex, duration = 6) {
        nailGlows.set(nailIndex, duration);
    }

    /**
     * Updates nail glow timers
     */
    function updateNailGlows() {
        for (const [index, remaining] of nailGlows) {
            if (remaining <= 1) {
                nailGlows.delete(index);
            } else {
                nailGlows.set(index, remaining - 1);
            }
        }
    }

    /**
     * Gets glow intensity for a nail
     * @param {number} nailIndex - Nail index
     * @returns {number} Glow intensity (0-1)
     */
    function getNailGlow(nailIndex) {
        const remaining = nailGlows.get(nailIndex);
        return remaining ? remaining / 6 : 0;
    }

    // ═══════════════════════════════════════════
    // Gol Animasyonu
    // ═══════════════════════════════════════════

    /** @type {Object} Goal animation state */
    const goalAnim = {
        active: false,
        timer: 0,
        duration: 120, // 2 seconds at 60fps
        scoringPlayer: 0
    };

    /**
     * Triggers goal animation
     * @param {number} scoringPlayer - Player who scored (1 or 2)
     * @param {number} goalX - Goal X position for particles
     * @param {number} goalY - Goal Y position for particles
     */
    function triggerGoalAnimation(scoringPlayer, goalX, goalY) {
        goalAnim.active = true;
        goalAnim.timer = goalAnim.duration;
        goalAnim.scoringPlayer = scoringPlayer;

        // Screen shake
        startShake(5, 18);

        // Confetti particles
        const color = scoringPlayer === 1 ? '#2196F3' : '#F44336';
        const colors = [color, '#f1c40f', '#ffffff', '#2ecc71'];
        for (let i = 0; i < 40; i++) {
            const c = colors[Math.floor(Math.random() * colors.length)];
            spawnParticles(goalX, goalY, c, 1, 6, 60);
        }

        // Show goal overlay
        const overlay = document.getElementById('goal-overlay');
        const goalText = document.getElementById('goal-text');
        if (overlay && goalText) {
            goalText.style.color = scoringPlayer === 1 ? '#2196F3' : '#F44336';
            overlay.classList.remove('hidden');
            setTimeout(() => {
                overlay.classList.add('hidden');
            }, 2000);
        }
    }

    /**
     * Updates goal animation
     */
    function updateGoalAnimation() {
        if (!goalAnim.active) return;
        goalAnim.timer--;
        if (goalAnim.timer <= 0) {
            goalAnim.active = false;
        }
    }

    /**
     * @returns {boolean} Whether goal animation is playing
     */
    function isGoalAnimating() {
        return goalAnim.active;
    }

    // ═══════════════════════════════════════════
    // Top Titreşim (Pulse) Efekti
    // ═══════════════════════════════════════════

    /** @type {Object} Ball pulse state */
    const ballPulse = {
        active: false,
        phase: 0
    };

    /**
     * Sets ball pulse state
     * @param {boolean} active
     */
    function setBallPulse(active) {
        ballPulse.active = active;
        if (!active) ballPulse.phase = 0;
    }

    /**
     * Gets ball pulse scale
     * @returns {number} Scale factor
     */
    function getBallPulseScale() {
        if (!ballPulse.active) return 1;
        ballPulse.phase += 0.1;
        return 1 + Math.sin(ballPulse.phase) * 0.08;
    }

    // ═══════════════════════════════════════════
    // Skor Animasyonu
    // ═══════════════════════════════════════════

    /** @type {Object} Score bounce state */
    const scoreBounce = {
        player: 0,
        timer: 0
    };

    /**
     * Triggers score bounce animation
     * @param {number} player - Player number (1 or 2)
     */
    function triggerScoreBounce(player) {
        scoreBounce.player = player;
        scoreBounce.timer = 30;
    }

    /**
     * Gets score bounce scale for a player
     * @param {number} player
     * @returns {number} Scale factor
     */
    function getScoreBounceScale(player) {
        if (scoreBounce.player !== player || scoreBounce.timer <= 0) return 1;
        scoreBounce.timer--;
        const progress = scoreBounce.timer / 30;
        return 1 + Math.sin(progress * Math.PI) * 0.3;
    }

    // ═══════════════════════════════════════════
    // Master Update
    // ═══════════════════════════════════════════

    /**
     * Updates all animations (call once per frame)
     */
    function update() {
        updateParticles();
        updateShake();
        updateNailGlows();
        updateGoalAnimation();
    }

    /**
     * Clears all active animations
     */
    function clearAll() {
        // Clear particles
        for (const p of activeParticles) {
            p.active = false;
        }
        activeParticles.length = 0;

        // Clear shake
        shake.active = false;
        shake.offsetX = 0;
        shake.offsetY = 0;

        // Clear nail glows
        nailGlows.clear();

        // Clear goal animation
        goalAnim.active = false;

        // Clear ball pulse
        ballPulse.active = false;
        ballPulse.phase = 0;
    }

    return {
        spawnParticles,
        drawParticles,
        startShake,
        getShakeOffset,
        triggerNailGlow,
        getNailGlow,
        triggerGoalAnimation,
        isGoalAnimating,
        setBallPulse,
        getBallPulseScale,
        triggerScoreBounce,
        getScoreBounceScale,
        update,
        clearAll
    };
})();
