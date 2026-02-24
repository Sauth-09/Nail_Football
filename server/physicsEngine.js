/**
 * physicsEngine.js - Sunucu Taraflı 2D Fizik Motoru
 * 
 * Özel yazılmış fizik motoru. Harici kütüphane kullanılmaz.
 * Top hareketi, çivi/duvar çarpışması, gol algılama ve
 * yörünge ön hesaplaması için kullanılır.
 * 
 * Fizik parametreleri:
 * - Sabit zaman adımı: 1/60 saniye (16.67ms)
 * - Elastik çarpışma modeli
 * - Sürtünme ile yavaşlama
 * - Penetrasyon düzeltmesi
 */

'use strict';

/** @constant {number} Physics timestep in seconds */
const PHYSICS_DT = 1 / 60;

/** @constant {number} Maximum simulation frames (10 seconds) */
const MAX_SIMULATION_FRAMES = 600;

/** @constant {number} Minimum speed threshold (px/s) */
const MIN_SPEED = 5;

/**
 * Calculates the deterministic Y position of the goalkeeper based on time
 * @param {number} t - Time in milliseconds since shot started
 * @param {Object} field - Field configuration
 * @param {number} startY - Goalkeeper center Y (usually field height / 2)
 * @returns {number} Current Y position
 */
function getGoalkeeperY(t, field, startY) {
    // Amplitude: 50, Speed multiplier: 0.003
    return startY + Math.sin(t * 0.003) * 50;
}

/**
 * Checks collision between ball and a capsule-shaped goalkeeper
 * @param {Object} ball - Ball state
 * @param {Object} gk - Goalkeeper state (x, y, width, height)
 * @returns {boolean} True if collides
 */
function checkGoalkeeperCollision(ball, gk) {
    const halfW = gk.width / 2;
    const halfH = gk.height / 2;

    let testX = ball.x;
    let testY = ball.y;

    if (ball.x < gk.x - halfW) testX = gk.x - halfW;
    else if (ball.x > gk.x + halfW) testX = gk.x + halfW;

    if (ball.y < gk.y - halfH) testY = gk.y - halfH;
    else if (ball.y > gk.y + halfH) testY = gk.y + halfH;

    const distX = ball.x - testX;
    const distY = ball.y - testY;
    const distance = Math.sqrt((distX * distX) + (distY * distY));

    return distance <= ball.radius;
}

/**
 * Physics simulation state
 * @typedef {Object} BallState
 * @property {number} x - Ball X position
 * @property {number} y - Ball Y position
 * @property {number} vx - Ball X velocity
 * @property {number} vy - Ball Y velocity
 * @property {number} radius - Ball radius
 */

/**
 * Simulates a full shot and returns the trajectory
 * @param {Object} fieldConfig - Field configuration
 * @param {number} angle - Shot angle in radians
 * @param {number} power - Shot power (0-1)
 * @param {Object} [startPos] - Optional start position override
 * @param {Object} [options] - Optional settings (goalkeeperEnabled, shotStartTime)
 * @returns {Object} Simulation result with trajectory and final state
 */
function simulateShot(fieldConfig, angle, power, startPos = null, options = {}) {
    const {
        fieldWidth, fieldHeight, goalWidth, goalDepth,
        friction, wallRestitution, nailRestitution,
        nailRadius, ballRadius, maxShotPower, nails
    } = fieldConfig;

    const ballStart = startPos || fieldConfig.ballStartPosition;

    // Initialize ball state
    const ball = {
        x: ballStart.x,
        y: ballStart.y,
        vx: Math.cos(angle) * power * maxShotPower,
        vy: Math.sin(angle) * power * maxShotPower,
        radius: ballRadius
    };

    // Goal boundaries
    const goalTop = (fieldHeight - goalWidth) / 2;
    const goalBottom = (fieldHeight + goalWidth) / 2;

    // Trajectory recording
    const trajectory = [];
    let goalScored = null; // null or { player: 1|2 }
    let frame = 0;

    // Record initial position
    trajectory.push({ x: ball.x, y: ball.y, t: 0 });

    const gkWidth = 12;
    const gkHeight = options.goalkeeperSize || 30;
    const gkBaseY = fieldHeight / 2;
    const gkLeftX = 70;
    const gkRightX = fieldWidth - 70;

    const shotStartTime = options.shotStartTime || 0;
    const isGkEnabled = options.goalkeeperEnabled === true;

    // Simulation loop
    while (frame < MAX_SIMULATION_FRAMES) {
        frame++;

        // Step 1: Apply velocity to position
        ball.x += ball.vx * PHYSICS_DT;
        ball.y += ball.vy * PHYSICS_DT;

        // Step 2: Wall collision detection
        // Top wall
        if (ball.y - ball.radius < 0) {
            ball.y = ball.radius;
            ball.vy = -ball.vy * wallRestitution;
        }
        // Bottom wall
        if (ball.y + ball.radius > fieldHeight) {
            ball.y = fieldHeight - ball.radius;
            ball.vy = -ball.vy * wallRestitution;
        }

        // Left wall (excluding goal area)
        if (ball.x - ball.radius < 0) {
            if (ball.y < goalTop || ball.y > goalBottom) {
                // Wall bounce
                ball.x = ball.radius;
                ball.vx = -ball.vx * wallRestitution;
            }
        }

        // Right wall (excluding goal area)
        if (ball.x + ball.radius > fieldWidth) {
            if (ball.y < goalTop || ball.y > goalBottom) {
                // Wall bounce
                ball.x = fieldWidth - ball.radius;
                ball.vx = -ball.vx * wallRestitution;
            }
        }

        // Step 3: Goal detection - returns which SIDE
        // P1 defends LEFT goal, P2 defends RIGHT goal
        // Left goal
        if (ball.x < goalDepth && ball.y > goalTop && ball.y < goalBottom) {
            goalScored = { side: 'left' };
            trajectory.push({ x: ball.x, y: ball.y, t: frame * PHYSICS_DT * 1000 });
            break;
        }
        // Right goal
        if (ball.x > fieldWidth - goalDepth && ball.y > goalTop && ball.y < goalBottom) {
            goalScored = { side: 'right' };
            trajectory.push({ x: ball.x, y: ball.y, t: frame * PHYSICS_DT * 1000 });
            break;
        }

        // Step 4: Nail collision detection
        for (const nail of nails) {
            const dx = ball.x - nail.x;
            const dy = ball.y - nail.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const minDist = ball.radius + nailRadius;

            if (distance < minDist && distance > 0) {
                // Collision detected!
                // Normal vector
                const nx = dx / distance;
                const ny = dy / distance;

                // Relative velocity along normal
                const dvn = ball.vx * nx + ball.vy * ny;

                // Only respond if approaching
                if (dvn < 0) {
                    // Reflect velocity
                    ball.vx -= (1 + nailRestitution) * dvn * nx;
                    ball.vy -= (1 + nailRestitution) * dvn * ny;
                }

                // Penetration correction
                const overlap = minDist - distance;
                ball.x += nx * overlap;
                ball.y += ny * overlap;
            }
        }

        // Step 4.5: Goalkeeper collision detection
        if (isGkEnabled) {
            const currentTimeMs = shotStartTime + (frame * PHYSICS_DT * 1000);
            const currentY = getGoalkeeperY(currentTimeMs, fieldConfig, gkBaseY);

            const gkLeft = { x: gkLeftX, y: currentY, width: gkWidth, height: gkHeight };
            const gkRight = { x: gkRightX, y: currentY, width: gkWidth, height: gkHeight };

            const gks = [gkLeft, gkRight];
            for (const gk of gks) {
                if (checkGoalkeeperCollision(ball, gk)) {
                    const dx = ball.x - gk.x;
                    const dy = ball.y - gk.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    const nx = dx / dist;
                    const ny = dy / dist;

                    const dvn = ball.vx * nx + ball.vy * ny;
                    if (dvn < 0) {
                        ball.vx -= (1 + wallRestitution) * dvn * nx;
                        ball.vy -= (1 + wallRestitution) * dvn * ny;
                    }

                    const overlap = ball.radius - dist;
                    if (overlap > 0) {
                        ball.x += nx * overlap;
                        ball.y += ny * overlap;
                    }
                }
            }
        }

        // Step 5: Apply friction
        ball.vx *= friction;
        ball.vy *= friction;

        // Step 6: Stop check
        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        if (speed < MIN_SPEED) {
            ball.vx = 0;
            ball.vy = 0;
            trajectory.push({ x: ball.x, y: ball.y, t: frame * PHYSICS_DT * 1000 });
            break;
        }

        // Record position every frame
        trajectory.push({ x: ball.x, y: ball.y, t: frame * PHYSICS_DT * 1000 });
    }

    // Force stop if max frames reached
    if (frame >= MAX_SIMULATION_FRAMES) {
        ball.vx = 0;
        ball.vy = 0;
    }

    return {
        trajectory,
        finalPosition: { x: ball.x, y: ball.y },
        goalScored,
        totalFrames: frame,
        totalTime: frame * PHYSICS_DT * 1000 // milliseconds
    };
}

/**
 * Validates shot parameters
 * @param {number} angle - Shot angle in radians
 * @param {number} power - Shot power (0-1)
 * @returns {boolean} Whether the parameters are valid
 */
function validateShot(angle, power) {
    if (typeof angle !== 'number' || isNaN(angle)) return false;
    if (typeof power !== 'number' || isNaN(power)) return false;
    if (power < 0 || power > 1) return false;
    return true;
}

module.exports = { simulateShot, validateShot, PHYSICS_DT, MAX_SIMULATION_FRAMES, MIN_SPEED, getGoalkeeperY };
