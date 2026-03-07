/**
 * fieldRenderer.js - Saha ve Çivi Çizim Motoru
 * 
 * Canvas üzerine katmanlı çizim:
 * 1. Zemin (çim/ahşap/koyu tema)
 * 2. Saha çizgileri (orta çizgi, daire, ceza sahası)
 * 3. Kaleler (direkler, ağ)
 * 4. Çiviler (3D metalik efekt)
 */

'use strict';

const FieldRenderer = (() => {
    /** @type {HTMLCanvasElement|null} Static field canvas (cached) */
    let staticCanvas = null;

    /** @type {Object|null} Current field config */
    let currentField = null;

    /** @type {string} Current theme */
    let currentTheme = 'grass';

    /** @type {string} Current ball theme */
    let currentBallTheme = 'classic';

    /** @type {string} Current nail theme */
    let currentNailTheme = 'metal';

    // ═══════════════════════════════════════════
    // Ball Theme Definitions
    // ═══════════════════════════════════════════
    const BALL_THEMES = {
        classic: {
            name: 'Klasik ⚽',
            light: '#ffffff', mid: '#e0e0e0', dark: '#bdbdbd',
            patternColor: 'rgba(0,0,0,0.15)',
            highlightAlpha: 0.6,
            glowColor: null, glowBlur: 0
        },
        fire: {
            name: 'Alev 🔥',
            light: '#ffcc00', mid: '#ff6600', dark: '#cc3300',
            patternColor: 'rgba(120,0,0,0.25)',
            highlightAlpha: 0.7,
            glowColor: '#ff4400', glowBlur: 18
        },
        neon: {
            name: 'Neon 💚',
            light: '#66ff66', mid: '#00e600', dark: '#009900',
            patternColor: 'rgba(0,80,0,0.2)',
            highlightAlpha: 0.8,
            glowColor: '#00ff44', glowBlur: 20
        },
        gold: {
            name: 'Altın ✨',
            light: '#fff9c4', mid: '#ffd700', dark: '#b8860b',
            patternColor: 'rgba(100,60,0,0.2)',
            highlightAlpha: 0.7,
            glowColor: '#ffd700', glowBlur: 14
        },
        ice: {
            name: 'Buz ❄️',
            light: '#e0f7fa', mid: '#80deea', dark: '#4dd0e1',
            patternColor: 'rgba(0,60,80,0.15)',
            highlightAlpha: 0.8,
            glowColor: '#00bcd4', glowBlur: 16
        }
    };

    // ═══════════════════════════════════════════
    // Nail Theme Definitions
    // ═══════════════════════════════════════════
    const NAIL_THEMES = {
        metal: {
            name: 'Metal ⬜',
            light: '#C0C0C0', mid: '#9E9E9E', dark: '#606060',
            glowLight: '#ffffff', glowDark: '#C0C0C0',
            glowColor: '#ffffff'
        },
        gold: {
            name: 'Altın 🟡',
            light: '#ffd700', mid: '#daa520', dark: '#b8860b',
            glowLight: '#fff9c4', glowDark: '#ffd700',
            glowColor: '#ffd700'
        },
        neon: {
            name: 'Neon 🟢',
            light: '#66ff66', mid: '#33cc33', dark: '#1a8c1a',
            glowLight: '#ccffcc', glowDark: '#66ff66',
            glowColor: '#00ff44'
        },
        ice: {
            name: 'Buz 🔵',
            light: '#80deea', mid: '#4dd0e1', dark: '#00838f',
            glowLight: '#e0f7fa', glowDark: '#80deea',
            glowColor: '#00bcd4'
        }
    };

    /** Theme color palettes */
    const THEMES = {
        grass: {
            bg: '#2d5a1b',
            bgAlt: '#356B20',
            lines: '#ffffff',
            goalNet: '#BDBDBD',
            goalPost: '#ffffff',
            goalBg: 'rgba(0,0,0,0.3)'
        },
        wood: {
            bg: '#8B6914',
            bgAlt: '#7A5C10',
            lines: '#D4A543',
            goalNet: '#C4A36F',
            goalPost: '#D4A543',
            goalBg: 'rgba(0,0,0,0.2)'
        },
        dark: {
            bg: '#1a1a2e',
            bgAlt: '#16213e',
            lines: '#4a5568',
            goalNet: '#4a5568',
            goalPost: '#8892b0',
            goalBg: 'rgba(0,0,0,0.4)'
        }
    };

    /**
     * Sets the field theme
     * @param {string} theme - 'grass', 'wood', or 'dark'
     */
    function setTheme(theme) {
        currentTheme = theme;
        staticCanvas = null; // Force redraw
    }

    /**
     * Renders the static field elements to a cached canvas
     * @param {Object} field - Field configuration
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     */
    function buildStaticField(field, width, height) {
        currentField = field;
        const dpr = window.devicePixelRatio || 1;

        staticCanvas = document.createElement('canvas');
        staticCanvas.width = Math.floor(width * dpr);
        staticCanvas.height = Math.floor(height * dpr);
        const ctx = staticCanvas.getContext('2d');
        ctx.scale(dpr, dpr);

        const scaleX = width / field.fieldWidth;
        const scaleY = height / field.fieldHeight;
        const theme = THEMES[currentTheme] || THEMES.grass;

        // Layer 1: Background
        drawBackground(ctx, width, height, theme);

        // Layer 2: Field lines
        drawFieldLines(ctx, field, scaleX, scaleY, theme);

        // Layer 3: Goals
        drawGoals(ctx, field, scaleX, scaleY, theme);
    }

    /**
     * Draws the background (grass pattern)
     */
    function drawBackground(ctx, width, height, theme) {
        ctx.fillStyle = theme.bg;
        ctx.fillRect(0, 0, width, height);

        // Grass/wood stripe effect
        ctx.fillStyle = theme.bgAlt;
        const stripeWidth = width / 14;
        for (let i = 0; i < 14; i += 2) {
            ctx.globalAlpha = 0.3;
            ctx.fillRect(i * stripeWidth, 0, stripeWidth, height);
        }
        ctx.globalAlpha = 1;
    }

    /**
     * Draws field lines (center, circle, penalty areas)
     */
    function drawFieldLines(ctx, field, scaleX, scaleY, theme) {
        ctx.strokeStyle = theme.lines;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6;

        const w = field.fieldWidth * scaleX;
        const h = field.fieldHeight * scaleY;
        const centerX = w / 2;
        const centerY = h / 2;

        // Border
        ctx.strokeRect(2, 2, w - 4, h - 4);

        // Center line
        ctx.beginPath();
        ctx.moveTo(centerX, 2);
        ctx.lineTo(centerX, h - 2);
        ctx.stroke();

        // Center circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, 60 * Math.min(scaleX, scaleY), 0, Math.PI * 2);
        ctx.stroke();

        // Center dot
        ctx.fillStyle = theme.lines;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
        ctx.fill();

        // Penalty areas
        const penaltyWidth = 100 * scaleX;
        const penaltyHeight = 200 * scaleY;
        const penaltyTop = centerY - penaltyHeight / 2;

        // Left penalty area
        ctx.strokeRect(2, penaltyTop, penaltyWidth, penaltyHeight);

        // Right penalty area
        ctx.strokeRect(w - penaltyWidth - 2, penaltyTop, penaltyWidth, penaltyHeight);

        ctx.globalAlpha = 1;
    }

    /**
     * Draws goal posts and net
     */
    function drawGoals(ctx, field, scaleX, scaleY, theme) {
        const goalTop = ((field.fieldHeight - field.goalWidth) / 2) * scaleY;
        const goalBottom = ((field.fieldHeight + field.goalWidth) / 2) * scaleY;
        const goalDepth = field.goalDepth * scaleX;
        const w = field.fieldWidth * scaleX;

        // Left goal = P1 (blue), Right goal = P2 (red)
        drawGoal(ctx, 0, goalTop, goalDepth, goalBottom - goalTop, true, theme, '#2196F3');
        drawGoal(ctx, w - goalDepth, goalTop, goalDepth, goalBottom - goalTop, false, theme, '#F44336');
    }

    /**
     * Draws a single goal
     */
    function drawGoal(ctx, x, y, width, height, isLeft, theme, playerColor) {
        // Goal background with player color tint
        const bgColor = playerColor || theme.goalBg;
        ctx.fillStyle = bgColor;
        ctx.globalAlpha = 0.25;
        ctx.fillRect(x, y, width, height);
        ctx.globalAlpha = 1;

        // Goal net pattern
        ctx.strokeStyle = playerColor || theme.goalNet;
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = 0.35;
        const spacing = 8;
        for (let i = 0; i < width; i += spacing) {
            ctx.beginPath();
            ctx.moveTo(x + i, y);
            ctx.lineTo(x + i, y + height);
            ctx.stroke();
        }
        for (let j = 0; j < height; j += spacing) {
            ctx.beginPath();
            ctx.moveTo(x, y + j);
            ctx.lineTo(x + width, y + j);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Goal posts with player color
        ctx.strokeStyle = playerColor || theme.goalPost;
        ctx.lineWidth = 4;
        ctx.beginPath();
        // Top post
        ctx.moveTo(isLeft ? x + width : x, y);
        ctx.lineTo(isLeft ? x : x + width, y);
        // Side
        ctx.lineTo(isLeft ? x : x + width, y + height);
        // Bottom post
        ctx.lineTo(isLeft ? x + width : x, y + height);
        ctx.stroke();

        // Player color glow on posts
        if (playerColor) {
            ctx.shadowColor = playerColor;
            ctx.shadowBlur = 8;
            ctx.strokeStyle = playerColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(isLeft ? x + width : x, y);
            ctx.lineTo(isLeft ? x : x + width, y);
            ctx.lineTo(isLeft ? x : x + width, y + height);
            ctx.lineTo(isLeft ? x + width : x, y + height);
            ctx.stroke();
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
        }
    }

    /**
     * Draws the cached static field
     * @param {CanvasRenderingContext2D} ctx - Target context
     * @param {number} width - Logical width
     * @param {number} height - Logical height
     */
    function drawStaticField(ctx, width, height) {
        if (staticCanvas) {
            // Draw high-res static canvas scaled down to logical width/height
            ctx.drawImage(staticCanvas, 0, 0, width, height);
        }
    }

    /**
     * Draws all nails with 3D metallic effect
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} field - Field configuration
     * @param {number} scaleX - Horizontal scale
     * @param {number} scaleY - Vertical scale
     */
    function drawNails(ctx, field, scaleX, scaleY) {
        const r = field.nailRadius;
        const nailTheme = NAIL_THEMES[currentNailTheme] || NAIL_THEMES.metal;

        for (let i = 0; i < field.nails.length; i++) {
            const nail = field.nails[i];
            const x = nail.x * scaleX;
            const y = nail.y * scaleY;
            const scaledR = r * Math.min(scaleX, scaleY);

            // Check glow
            const glow = AnimationManager.getNailGlow(i);

            if (glow > 0) {
                // Glow effect with theme color
                ctx.shadowColor = nailTheme.glowColor;
                ctx.shadowBlur = 15 * glow;
            }

            // Nail body (radial gradient for 3D effect)
            const gradient = ctx.createRadialGradient(
                x - scaledR * 0.3, y - scaledR * 0.3, scaledR * 0.1,
                x, y, scaledR
            );

            if (glow > 0) {
                gradient.addColorStop(0, nailTheme.glowLight);
                gradient.addColorStop(1, nailTheme.glowDark);
            } else {
                gradient.addColorStop(0, nailTheme.light);
                gradient.addColorStop(0.7, nailTheme.mid);
                gradient.addColorStop(1, nailTheme.dark);
            }

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, scaledR, 0, Math.PI * 2);
            ctx.fill();

            // Highlight (top-left)
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.beginPath();
            ctx.arc(x - scaledR * 0.25, y - scaledR * 0.25, scaledR * 0.25, 0, Math.PI * 2);
            ctx.fill();

            // Shadow (bottom-right)
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.beginPath();
            ctx.arc(x + scaledR * 0.15, y + scaledR * 0.15, scaledR * 0.8, 0, Math.PI * 2);
            ctx.fill();

            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
        }
    }

    /**
     * Draws the ball
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} x - Ball X (field coords)
     * @param {number} y - Ball Y (field coords)
     * @param {number} radius - Ball radius
     * @param {number} scaleX
     * @param {number} scaleY
     */
    function drawBall(ctx, x, y, radius, scaleX, scaleY, playerColor) {
        const bx = x * scaleX;
        const by = y * scaleY;
        const br = radius * Math.min(scaleX, scaleY);
        const pulseScale = AnimationManager.getBallPulseScale();
        const r = br * pulseScale;
        const ballTheme = BALL_THEMES[currentBallTheme] || BALL_THEMES.classic;

        // Player color baz alınarak açık/koyu tonlar oluşturulur
        const lightColor = playerColor ? adjustBrightness(playerColor, 60) : ballTheme.light;
        const midColor = playerColor ? adjustBrightness(playerColor, 20) : ballTheme.mid;
        const darkColor = playerColor ? adjustBrightness(playerColor, -40) : ballTheme.dark;
        
        // Tema efektleri her zaman korunur (örneğin Alev glowBlur: 18, Neon: 20)
        const patternColor = ballTheme.patternColor;
        const glowCol = (ballTheme.glowBlur > 0) ? (playerColor || ballTheme.glowColor) : null;
        const glowBlur = ballTheme.glowBlur;

        // Ball shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.ellipse(bx + 2, by + 3, r * 0.9, r * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Theme-specific outer glow (drawn before ball body)
        if (glowCol && glowBlur > 0) {
            ctx.save();
            ctx.shadowColor = glowCol;
            ctx.shadowBlur = glowBlur;
            ctx.fillStyle = 'rgba(0,0,0,0)';
            ctx.beginPath();
            ctx.arc(bx, by, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Ball body
        const gradient = ctx.createRadialGradient(
            bx - r * 0.2, by - r * 0.3, r * 0.1,
            bx, by, r
        );
        gradient.addColorStop(0, lightColor);
        gradient.addColorStop(0.8, midColor);
        gradient.addColorStop(1, darkColor);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(bx, by, r, 0, Math.PI * 2);
        ctx.fill();

        // Ball pattern (simple pentagon pattern)
        ctx.strokeStyle = patternColor;
        ctx.lineWidth = 0.5;
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
            const px = bx + Math.cos(angle) * r * 0.55;
            const py = by + Math.sin(angle) * r * 0.55;
            ctx.beginPath();
            ctx.arc(px, py, r * 0.2, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Highlight
        ctx.fillStyle = `rgba(255, 255, 255, ${ballTheme.highlightAlpha})`;
        ctx.beginPath();
        ctx.arc(bx - r * 0.25, by - r * 0.3, r * 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Glow ring (theme or player color)
        if (glowCol) {
            ctx.shadowColor = glowCol;
            ctx.shadowBlur = glowBlur;
            ctx.strokeStyle = glowCol;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(bx, by, r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
        }
    }

    /**
     * Adjusts hex color brightness
     * @param {string} hex - Hex color
     * @param {number} amount - Amount to adjust (-255 to 255)
     * @returns {string} Adjusted hex color
     */
    function adjustBrightness(hex, amount) {
        const num = parseInt(hex.replace('#', ''), 16);
        const r = Math.min(255, Math.max(0, (num >> 16) + amount));
        const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
        const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
        return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
    }

    /**
     * Renders a mini preview of a field (for field selection)
     * @param {HTMLCanvasElement} canvas - Preview canvas
     * @param {Object} field - Field configuration
     */
    function drawMiniPreview(canvas, field) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const scaleX = w / field.fieldWidth;
        const scaleY = h / field.fieldHeight;
        const theme = THEMES[currentTheme] || THEMES.grass;

        // Background
        ctx.fillStyle = theme.bg;
        ctx.fillRect(0, 0, w, h);

        // Lines
        ctx.strokeStyle = theme.lines;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.4;
        ctx.strokeRect(1, 1, w - 2, h - 2);

        // Center line
        ctx.beginPath();
        ctx.moveTo(w / 2, 0);
        ctx.lineTo(w / 2, h);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Goals
        const goalTop = ((field.fieldHeight - field.goalWidth) / 2) * scaleY;
        const goalH = field.goalWidth * scaleY;
        const goalD = field.goalDepth * scaleX;
        ctx.fillStyle = theme.goalBg;
        ctx.fillRect(0, goalTop, goalD, goalH);
        ctx.fillRect(w - goalD, goalTop, goalD, goalH);

        // Nails
        const nails = field.nails || [];
        ctx.fillStyle = '#9E9E9E';
        const r = Math.max(2, field.nailRadius * Math.min(scaleX, scaleY) * 0.8);
        for (const nail of nails) {
            ctx.beginPath();
            ctx.arc(nail.x * scaleX, nail.y * scaleY, r, 0, Math.PI * 2);
            ctx.fill();
        }

        // Ball
        ctx.fillStyle = '#ffffff';
        const bp = field.ballStartPosition;
        ctx.beginPath();
        ctx.arc(bp.x * scaleX, bp.y * scaleY, Math.max(2, r * 1.2), 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * Invalidates the static cache (forces rebuild)
     */
    function invalidateCache() {
        staticCanvas = null;
    }

    /**
     * Sets the ball theme
     * @param {string} theme - Ball theme key
     */
    function setBallTheme(theme) {
        if (BALL_THEMES[theme]) {
            currentBallTheme = theme;
        }
    }

    /**
     * Sets the nail theme
     * @param {string} theme - Nail theme key
     */
    function setNailTheme(theme) {
        if (NAIL_THEMES[theme]) {
            currentNailTheme = theme;
        }
    }

    return {
        setTheme,
        setBallTheme,
        setNailTheme,
        buildStaticField,
        drawStaticField,
        drawNails,
        drawBall,
        drawMiniPreview,
        invalidateCache,
        THEMES,
        BALL_THEMES,
        NAIL_THEMES
    };
})();
