/**
 * fansRenderer.js - Stadium Fan/Supporter Renderer
 * 
 * Renders team-colored fans in stadium-style tribune sections on left and right
 * sides of the game field. Features:
 * - Multiple rows with depth perspective
 * - Idle sway animations for life-like feel
 * - Goal celebrations with jumping, arm waving, confetti
 * - Stadium tribune backdrop with gradient stands
 * 
 * Uses HTML/CSS elements (not canvas) for smooth animations.
 */

'use strict';

const FansRenderer = (() => {
    // ═══════════════════════════════════════════
    // Constants
    // ═══════════════════════════════════════════

    /** Number of fans per row */
    const FANS_PER_ROW = 3;

    /** Number of rows for depth */
    const ROWS = 5;

    /** Total fans per side */
    const FANS_PER_SIDE = FANS_PER_ROW * ROWS;

    // ═══════════════════════════════════════════
    // State
    // ═══════════════════════════════════════════

    /** @type {HTMLElement|null} Left fans container */
    let leftContainer = null;

    /** @type {HTMLElement|null} Right fans container */
    let rightContainer = null;

    /** @type {boolean} Whether fans are initialized */
    let initialized = false;

    /** @type {number|null} Idle animation interval */
    let idleInterval = null;

    /** @type {Object} Track timeout IDs per container side to avoid conflicts */
    const celebrationTimeouts = {
        left: null,
        right: null
    };

    // ═══════════════════════════════════════════
    // Fan Creation
    // ═══════════════════════════════════════════

    /**
     * Creates a single fan SVG element with variety
     * @param {string} shirtColor - Primary color
     * @param {string} detailColor - Secondary color
     * @param {number} index - Fan index for variation
     * @param {number} row - Row index (0 = front, higher = back)
     * @returns {HTMLElement}
     */
    function createFanElement(shirtColor, detailColor, index, row) {
        const fan = document.createElement('div');
        fan.className = 'fan-person';
        fan.dataset.row = row;

        // Random variation for natural look
        const heightVar = 0.82 + Math.random() * 0.36;
        const delay = Math.random() * 2;
        const swaySpeed = 2.5 + Math.random() * 2;
        fan.style.setProperty('--fan-height-var', heightVar);
        fan.style.setProperty('--fan-anim-delay', `${delay}s`);
        fan.style.setProperty('--fan-sway-speed', `${swaySpeed}s`);

        // Color variety - mix between team colors and some neutral variations
        const colorVariant = index % 5;
        let mainColor, altColor;
        switch (colorVariant) {
            case 0: mainColor = shirtColor; altColor = detailColor; break;
            case 1: mainColor = detailColor; altColor = shirtColor; break;
            case 2: mainColor = shirtColor; altColor = '#ffffff'; break;
            case 3: mainColor = detailColor; altColor = '#333333'; break;
            default: mainColor = shirtColor; altColor = detailColor; break;
        }

        // Skin tone variety
        const skinTones = ['#FFCC99', '#F5D0A9', '#D2A67F', '#C68642', '#8D5524'];
        const skinColor = skinTones[index % skinTones.length];

        // Some fans have accessories (scarves, hats)
        const hasScarf = index % 4 === 0;
        const hasHat = index % 7 === 0;

        let accessorySVG = '';
        if (hasScarf) {
            accessorySVG = `<rect x="7" y="10" width="10" height="2" rx="1" fill="${altColor}" opacity="0.9"/>`;
        }
        if (hasHat) {
            accessorySVG = `<rect x="7" y="1" width="10" height="3" rx="1.5" fill="${mainColor}" opacity="0.95"/>`;
        }

        fan.innerHTML = `
            <svg viewBox="0 0 24 40" class="fan-svg">
                <!-- Head -->
                <circle cx="12" cy="6" r="4.5" fill="${skinColor}" stroke="#B8860B" stroke-width="0.3"/>
                ${accessorySVG}
                <!-- Body / Shirt -->
                <rect x="6" y="11" width="12" height="12" rx="2" fill="${mainColor}" stroke="${altColor}" stroke-width="0.8"/>
                <!-- Number on shirt -->
                <text x="12" y="20" text-anchor="middle" fill="${altColor}" font-size="5" font-weight="bold" opacity="0.7">${(index % 11) + 1}</text>
                <!-- Arms -->
                <line x1="6" y1="13" x2="2" y2="20" stroke="${mainColor}" stroke-width="2.5" stroke-linecap="round" class="fan-arm-left"/>
                <line x1="18" y1="13" x2="22" y2="20" stroke="${mainColor}" stroke-width="2.5" stroke-linecap="round" class="fan-arm-right"/>
                <!-- Pants -->
                <rect x="7" y="23" width="4" height="8" rx="1" fill="#333"/>
                <rect x="13" y="23" width="4" height="8" rx="1" fill="#333"/>
                <!-- Feet -->
                <ellipse cx="9" cy="32" rx="3" ry="1.5" fill="#555"/>
                <ellipse cx="15" cy="32" rx="3" ry="1.5" fill="#555"/>
            </svg>
        `;

        return fan;
    }

    /**
     * Creates the tribune backdrop element
     * @param {string} side - 'left' or 'right'
     * @param {string} color1 - Primary team color
     * @param {string} color2 - Secondary team color
     * @returns {HTMLElement}
     */
    function createTribuneBackdrop(side, color1, color2) {
        const backdrop = document.createElement('div');
        backdrop.className = `tribune-backdrop tribune-${side}`;
        backdrop.style.background = `linear-gradient(180deg, 
            ${color1}33 0%, 
            ${color1}22 30%, 
            ${color2}15 60%, 
            rgba(20,20,30,0.8) 100%)`;
        return backdrop;
    }

    /**
     * Initializes fans on both sides
     * @param {Object|null} leftTeam - Left team data from TeamManager
     * @param {Object|null} rightTeam - Right team data from TeamManager
     */
    function init(leftTeam, rightTeam) {
        destroy(); // Clean up any previous fans

        if (!leftTeam && !rightTeam) {
            return;
        }

        const canvasContainer = document.getElementById('canvas-container');
        if (!canvasContainer) return;

        // Create left fans
        if (leftTeam) {
            leftContainer = document.createElement('div');
            leftContainer.className = 'fans-container fans-container-left';
            leftContainer.id = 'fans-left';
            
            // Add tribune backdrop
            const backdrop = createTribuneBackdrop('left', leftTeam.colors[0], leftTeam.colors[1]);
            leftContainer.appendChild(backdrop);
            
            buildFans(leftContainer, leftTeam.colors[0], leftTeam.colors[1]);
            canvasContainer.appendChild(leftContainer);
        }

        // Create right fans
        if (rightTeam) {
            rightContainer = document.createElement('div');
            rightContainer.className = 'fans-container fans-container-right';
            rightContainer.id = 'fans-right';
            
            // Add tribune backdrop
            const backdrop = createTribuneBackdrop('right', rightTeam.colors[0], rightTeam.colors[1]);
            rightContainer.appendChild(backdrop);
            
            buildFans(rightContainer, rightTeam.colors[0], rightTeam.colors[1]);
            canvasContainer.appendChild(rightContainer);
        }

        initialized = true;

        // Start idle animations
        startIdleAnimations();

        console.log('[FansRenderer] Fans initialized',
            leftTeam ? `Left: ${leftTeam.name}` : '',
            rightTeam ? `Right: ${rightTeam.name}` : '');
    }

    /**
     * Builds fan elements inside a container
     * @param {HTMLElement} container
     * @param {string} color1 - Primary team color
     * @param {string} color2 - Secondary team color
     */
    function buildFans(container, color1, color2) {
        for (let row = 0; row < ROWS; row++) {
            const rowDiv = document.createElement('div');
            rowDiv.className = `fan-row fan-row-${row}`;

            for (let i = 0; i < FANS_PER_ROW; i++) {
                const fanIndex = row * FANS_PER_ROW + i;
                const fan = createFanElement(color1, color2, fanIndex, row);
                rowDiv.appendChild(fan);
            }

            container.appendChild(rowDiv);
        }
    }

    /**
     * Starts ambient idle animations - random fans sway gently
     */
    function startIdleAnimations() {
        // Disabled idle animations for performance.
        // Fans will only animate when a goal is scored via onGoal()
        if (idleInterval) clearInterval(idleInterval);
        idleInterval = null;
    }

    /**
     * Triggers goal celebration for the scoring player's fans
     * Player 1 = left side, Player 2 = right side
     * @param {number} scoringPlayer - 1 or 2
     */
    function onGoal(scoringPlayer) {
        if (!initialized) return;

        const side = scoringPlayer === 1 ? 'left' : 'right';
        const container = scoringPlayer === 1 ? leftContainer : rightContainer;
        if (!container) return;

        // Clear any existing celebration timeout for this side
        if (celebrationTimeouts[side]) {
            clearTimeout(celebrationTimeouts[side]);
            celebrationTimeouts[side] = null;
        }

        // Add celebrating class
        container.classList.add('celebrating');
        console.log(`[FansRenderer] Player ${scoringPlayer} fans celebrating!`);

        // Spawn confetti particles
        spawnConfetti(container);

        // Fetch configured duration from global settings, default to 15s
        const settings = (typeof UIManager !== 'undefined') ? UIManager.getSettings() : { anthemDuration: 15 };
        const durationMs = (settings.anthemDuration || 15) * 1000;

        // Remove after animation
        celebrationTimeouts[side] = setTimeout(() => {
            if (container) {
                container.classList.remove('celebrating');
            }
            celebrationTimeouts[side] = null;
        }, durationMs);
    }

    /**
     * Adjusts the celebration duration for a player's fans (e.g. once music actually starts playing)
     * @param {number} scoringPlayer - 1 or 2
     * @param {number} durationMs - New duration in milliseconds
     */
    function adjustCelebrationDuration(scoringPlayer, durationMs) {
        if (!initialized) return;

        const side = scoringPlayer === 1 ? 'left' : 'right';
        const container = scoringPlayer === 1 ? leftContainer : rightContainer;
        if (!container) return;

        // Only adjust if currently celebrating
        if (container.classList.contains('celebrating')) {
            if (celebrationTimeouts[side]) {
                clearTimeout(celebrationTimeouts[side]);
            }
            celebrationTimeouts[side] = setTimeout(() => {
                if (container) {
                    container.classList.remove('celebrating');
                }
                celebrationTimeouts[side] = null;
            }, durationMs);
            console.log(`[FansRenderer] Adjusted celebration duration for Player ${scoringPlayer} to ${durationMs}ms`);
        }
    }

    /**
     * Spawns confetti particles inside a container
     * @param {HTMLElement} container
     */
    function spawnConfetti(container) {
        const colors = ['#ff0', '#f00', '#0f0', '#00f', '#ff0', '#f0f', '#0ff', '#fff'];
        const confettiCount = 20;

        for (let i = 0; i < confettiCount; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'fan-confetti';
            confetti.style.setProperty('--confetti-x', `${Math.random() * 100}%`);
            confetti.style.setProperty('--confetti-delay', `${Math.random() * 0.5}s`);
            confetti.style.setProperty('--confetti-speed', `${1 + Math.random() * 2}s`);
            confetti.style.setProperty('--confetti-rotate', `${Math.random() * 720}deg`);
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            container.appendChild(confetti);

            // Remove after animation
            setTimeout(() => {
                if (confetti.parentNode) {
                    confetti.parentNode.removeChild(confetti);
                }
            }, 3500);
        }
    }

    /**
     * Resets fan states (removes celebrations)
     */
    function reset() {
        if (celebrationTimeouts.left) {
            clearTimeout(celebrationTimeouts.left);
            celebrationTimeouts.left = null;
        }
        if (celebrationTimeouts.right) {
            clearTimeout(celebrationTimeouts.right);
            celebrationTimeouts.right = null;
        }
        if (leftContainer) leftContainer.classList.remove('celebrating');
        if (rightContainer) rightContainer.classList.remove('celebrating');
    }

    /**
     * Removes all fan elements from DOM
     */
    function destroy() {
        if (idleInterval) {
            clearInterval(idleInterval);
            idleInterval = null;
        }
        if (celebrationTimeouts.left) {
            clearTimeout(celebrationTimeouts.left);
            celebrationTimeouts.left = null;
        }
        if (celebrationTimeouts.right) {
            clearTimeout(celebrationTimeouts.right);
            celebrationTimeouts.right = null;
        }
        if (leftContainer && leftContainer.parentNode) {
            leftContainer.parentNode.removeChild(leftContainer);
        }
        if (rightContainer && rightContainer.parentNode) {
            rightContainer.parentNode.removeChild(rightContainer);
        }
        leftContainer = null;
        rightContainer = null;
        initialized = false;
    }

    /**
     * @returns {boolean} Whether fans are active
     */
    function isActive() {
        return initialized;
    }

    return {
        init,
        onGoal,
        adjustCelebrationDuration,
        reset,
        destroy,
        isActive
    };
})();
