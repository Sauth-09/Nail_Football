/**
 * fansRenderer.js - Stadium Fan/Supporter Renderer
 * 
 * Renders team-colored fans on left and right sides of the game field.
 * Fans stand up and celebrate when their team scores.
 * Uses HTML/CSS elements (not canvas) for smooth animations.
 */

'use strict';

const FansRenderer = (() => {
    // ═══════════════════════════════════════════
    // Constants
    // ═══════════════════════════════════════════

    /** Number of fans per side */
    const FANS_PER_SIDE = 8;

    /** Number of rows */
    const ROWS = 2;

    // ═══════════════════════════════════════════
    // State
    // ═══════════════════════════════════════════

    /** @type {HTMLElement|null} Left fans container */
    let leftContainer = null;

    /** @type {HTMLElement|null} Right fans container */
    let rightContainer = null;

    /** @type {boolean} Whether fans are initialized */
    let initialized = false;

    // ═══════════════════════════════════════════
    // Fan Creation
    // ═══════════════════════════════════════════

    /**
     * Creates a single fan SVG element
     * @param {string} shirtColor - Primary color
     * @param {string} detailColor - Secondary color
     * @param {number} index - Fan index for variation
     * @returns {HTMLElement}
     */
    function createFanElement(shirtColor, detailColor, index) {
        const fan = document.createElement('div');
        fan.className = 'fan-person';
        
        // Slight random variation for natural look
        const heightVar = 0.85 + Math.random() * 0.3;
        const delay = Math.random() * 0.3;
        fan.style.setProperty('--fan-height-var', heightVar);
        fan.style.setProperty('--fan-anim-delay', `${delay}s`);

        // Alternate between colors for variety
        const mainColor = index % 3 === 0 ? detailColor : shirtColor;
        const altColor = index % 3 === 0 ? shirtColor : detailColor;

        fan.innerHTML = `
            <svg viewBox="0 0 24 40" class="fan-svg">
                <!-- Head -->
                <circle cx="12" cy="6" r="4.5" fill="#FFCC99" stroke="#E0A870" stroke-width="0.5"/>
                <!-- Body / Shirt -->
                <rect x="6" y="11" width="12" height="12" rx="2" fill="${mainColor}" stroke="${altColor}" stroke-width="0.8"/>
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
     * Initializes fans on both sides
     * @param {Object|null} leftTeam - Left team data from TeamManager
     * @param {Object|null} rightTeam - Right team data from TeamManager
     */
    function init(leftTeam, rightTeam) {
        destroy(); // Clean up any previous fans

        if (!leftTeam && !rightTeam) {
            // No teams selected, no fans
            return;
        }

        const gameScreen = document.getElementById('game-screen');
        if (!gameScreen) return;

        // Create left fans
        if (leftTeam) {
            leftContainer = document.createElement('div');
            leftContainer.className = 'fans-container fans-container-left';
            leftContainer.id = 'fans-left';
            buildFans(leftContainer, leftTeam.colors[0], leftTeam.colors[1]);
            gameScreen.appendChild(leftContainer);
        }

        // Create right fans
        if (rightTeam) {
            rightContainer = document.createElement('div');
            rightContainer.className = 'fans-container fans-container-right';
            rightContainer.id = 'fans-right';
            buildFans(rightContainer, rightTeam.colors[0], rightTeam.colors[1]);
            gameScreen.appendChild(rightContainer);
        }

        initialized = true;
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
        const fansPerRow = Math.ceil(FANS_PER_SIDE / ROWS);

        for (let row = 0; row < ROWS; row++) {
            const rowDiv = document.createElement('div');
            rowDiv.className = `fan-row fan-row-${row}`;

            for (let i = 0; i < fansPerRow; i++) {
                const fanIndex = row * fansPerRow + i;
                const fan = createFanElement(color1, color2, fanIndex);
                rowDiv.appendChild(fan);
            }

            container.appendChild(rowDiv);
        }
    }

    /**
     * Triggers goal celebration for the scoring player's fans
     * Player 1 = left side, Player 2 = right side
     * @param {number} scoringPlayer - 1 or 2
     */
    function onGoal(scoringPlayer) {
        if (!initialized) return;

        // Player 1's fans are on the left, Player 2's on the right
        const container = scoringPlayer === 1 ? leftContainer : rightContainer;
        if (!container) return;

        // Add celebrating class
        container.classList.add('celebrating');
        console.log(`[FansRenderer] Player ${scoringPlayer} fans celebrating!`);

        // Remove after animation
        setTimeout(() => {
            if (container) {
                container.classList.remove('celebrating');
            }
        }, 4000);
    }

    /**
     * Resets fan states (removes celebrations)
     */
    function reset() {
        if (leftContainer) leftContainer.classList.remove('celebrating');
        if (rightContainer) rightContainer.classList.remove('celebrating');
    }

    /**
     * Removes all fan elements from DOM
     */
    function destroy() {
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
        reset,
        destroy,
        isActive
    };
})();
