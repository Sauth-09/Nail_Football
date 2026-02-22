/**
 * physicsClient.js - İstemci Taraflı Fizik Simülasyonu
 * 
 * Yerel (tek cihaz) modda fizik hesaplamaları istemcide yapılır.
 * Multiplayer modda ise sunucudan gelen yörüngeyi oynatır.
 * 
 * Fizik parametreleri sunucu tarafıyla aynıdır:
 * - Sabit zaman adımı: 1/60 saniye
 * - Elastik çarpışma modeli
 * - Sürtünme ile yavaşlama
 */

'use strict';

const PhysicsClient = (() => {
    /** @constant {number} Physics timestep in seconds */
    const DT = 1 / 60;

    /** @constant {number} Maximum simulation frames */
    const MAX_FRAMES = 600;

    /** @constant {number} Minimum speed threshold */
    const MIN_SPEED = 5;

    /**
     * Simulates a shot locally (for local mode)
     * @param {Object} field - Field configuration
     * @param {number} angle - Shot angle in radians
     * @param {number} power - Shot power (0-1)
     * @param {Object} ballPos - Ball start position {x, y}
     * @returns {Object} Result with trajectory and collision events
     */
    function simulateShot(field, angle, power, ballPos) {
        const ball = {
            x: ballPos.x,
            y: ballPos.y,
            vx: Math.cos(angle) * power * field.maxShotPower,
            vy: Math.sin(angle) * power * field.maxShotPower,
            radius: field.ballRadius
        };

        const goalTop = (field.fieldHeight - field.goalWidth) / 2;
        const goalBottom = (field.fieldHeight + field.goalWidth) / 2;

        const trajectory = [{ x: ball.x, y: ball.y, t: 0 }];
        const collisionEvents = []; // {type, index, x, y, frame}
        let goalScored = null;
        let frame = 0;

        while (frame < MAX_FRAMES) {
            frame++;

            // Apply velocity
            ball.x += ball.vx * DT;
            ball.y += ball.vy * DT;

            // Wall collisions
            if (ball.y - ball.radius < 0) {
                ball.y = ball.radius;
                ball.vy = -ball.vy * field.wallRestitution;
                collisionEvents.push({ type: 'wall', x: ball.x, y: ball.y, frame });
            }
            if (ball.y + ball.radius > field.fieldHeight) {
                ball.y = field.fieldHeight - ball.radius;
                ball.vy = -ball.vy * field.wallRestitution;
                collisionEvents.push({ type: 'wall', x: ball.x, y: ball.y, frame });
            }
            if (ball.x - ball.radius < 0) {
                if (ball.y < goalTop || ball.y > goalBottom) {
                    ball.x = ball.radius;
                    ball.vx = -ball.vx * field.wallRestitution;
                    collisionEvents.push({ type: 'wall', x: ball.x, y: ball.y, frame });
                }
            }
            if (ball.x + ball.radius > field.fieldWidth) {
                if (ball.y < goalTop || ball.y > goalBottom) {
                    ball.x = field.fieldWidth - ball.radius;
                    ball.vx = -ball.vx * field.wallRestitution;
                    collisionEvents.push({ type: 'wall', x: ball.x, y: ball.y, frame });
                }
            }

            // Goal detection - returns which SIDE the goal is in
            // P1 defends LEFT goal, P2 defends RIGHT goal
            if (ball.x < field.goalDepth && ball.y > goalTop && ball.y < goalBottom) {
                goalScored = { side: 'left' };  // Sol kaleye gol
                trajectory.push({ x: ball.x, y: ball.y, t: frame * DT * 1000 });
                break;
            }
            if (ball.x > field.fieldWidth - field.goalDepth && ball.y > goalTop && ball.y < goalBottom) {
                goalScored = { side: 'right' }; // Sağ kaleye gol
                trajectory.push({ x: ball.x, y: ball.y, t: frame * DT * 1000 });
                break;
            }

            // Nail collisions
            for (let i = 0; i < field.nails.length; i++) {
                const nail = field.nails[i];
                const dx = ball.x - nail.x;
                const dy = ball.y - nail.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const minDist = ball.radius + field.nailRadius;

                if (distance < minDist && distance > 0) {
                    const nx = dx / distance;
                    const ny = dy / distance;
                    const dvn = ball.vx * nx + ball.vy * ny;

                    if (dvn < 0) {
                        ball.vx -= (1 + field.nailRestitution) * dvn * nx;
                        ball.vy -= (1 + field.nailRestitution) * dvn * ny;
                    }

                    const overlap = minDist - distance;
                    ball.x += nx * overlap;
                    ball.y += ny * overlap;

                    collisionEvents.push({
                        type: 'nail', index: i,
                        x: nail.x, y: nail.y, frame
                    });
                }
            }

            // Friction
            ball.vx *= field.friction;
            ball.vy *= field.friction;

            // Stop check
            const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            if (speed < MIN_SPEED) {
                ball.vx = 0;
                ball.vy = 0;
                trajectory.push({ x: ball.x, y: ball.y, t: frame * DT * 1000 });
                break;
            }

            trajectory.push({ x: ball.x, y: ball.y, t: frame * DT * 1000 });
        }

        if (frame >= MAX_FRAMES) {
            ball.vx = 0;
            ball.vy = 0;
        }

        return {
            trajectory,
            collisionEvents,
            finalPosition: { x: ball.x, y: ball.y },
            goalScored,
            totalFrames: frame
        };
    }

    // ═══════════════════════════════════════════
    // Yörünge Oynatıcı (Trajectory Player)
    // ═══════════════════════════════════════════

    /** @type {Object} Playback state */
    const playback = {
        active: false,
        trajectory: [],
        collisionEvents: [],
        currentFrame: 0,
        goalScored: null,
        onComplete: null,
        onCollision: null
    };

    /**
     * Starts playing a trajectory
     * @param {Object} result - Simulation result
     * @param {Function} onCollision - Callback for collisions
     * @param {Function} onComplete - Callback when playback finishes
     */
    function startPlayback(result, onCollision, onComplete) {
        playback.active = true;
        playback.trajectory = result.trajectory;
        playback.collisionEvents = result.collisionEvents || [];
        playback.currentFrame = 0;
        playback.goalScored = result.goalScored;
        playback.onComplete = onComplete;
        playback.onCollision = onCollision;
    }

    /**
     * Advances playback by one frame
     * @returns {Object|null} Current ball position or null if not playing
     */
    function advancePlayback() {
        if (!playback.active || playback.currentFrame >= playback.trajectory.length) {
            if (playback.active) {
                playback.active = false;
                if (playback.onComplete) {
                    playback.onComplete(playback.goalScored);
                }
            }
            return null;
        }

        // Check for collision events at this frame
        if (playback.onCollision) {
            for (const event of playback.collisionEvents) {
                if (event.frame === playback.currentFrame) {
                    playback.onCollision(event);
                }
            }
        }

        const pos = playback.trajectory[playback.currentFrame];
        playback.currentFrame++;
        return pos;
    }

    /**
     * @returns {boolean} Whether playback is active
     */
    function isPlaying() {
        return playback.active;
    }

    /**
     * Stops playback
     */
    function stopPlayback() {
        playback.active = false;
    }

    return {
        simulateShot,
        startPlayback,
        advancePlayback,
        isPlaying,
        stopPlayback
    };
})();
