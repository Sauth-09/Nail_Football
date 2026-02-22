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
        staticCanvas = document.createElement('canvas');
        staticCanvas.width = width;
        staticCanvas.height = height;
        const ctx = staticCanvas.getContext('2d');

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

        // Left goal
        drawGoal(ctx, 0, goalTop, goalDepth, goalBottom - goalTop, true, theme);

        // Right goal
        drawGoal(ctx, w - goalDepth, goalTop, goalDepth, goalBottom - goalTop, false, theme);
    }

    /**
     * Draws a single goal
     */
    function drawGoal(ctx, x, y, width, height, isLeft, theme) {
        // Goal background
        ctx.fillStyle = theme.goalBg;
        ctx.fillRect(x, y, width, height);

        // Goal net pattern
        ctx.strokeStyle = theme.goalNet;
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = 0.4;
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

        // Goal posts
        ctx.strokeStyle = theme.goalPost;
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
    }

    /**
     * Draws the cached static field
     * @param {CanvasRenderingContext2D} ctx - Target context
     */
    function drawStaticField(ctx) {
        if (staticCanvas) {
            ctx.drawImage(staticCanvas, 0, 0);
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

        for (let i = 0; i < field.nails.length; i++) {
            const nail = field.nails[i];
            const x = nail.x * scaleX;
            const y = nail.y * scaleY;
            const scaledR = r * Math.min(scaleX, scaleY);

            // Check glow
            const glow = AnimationManager.getNailGlow(i);

            if (glow > 0) {
                // Glow effect
                ctx.shadowColor = '#ffffff';
                ctx.shadowBlur = 15 * glow;
            }

            // Nail body (radial gradient for 3D effect)
            const gradient = ctx.createRadialGradient(
                x - scaledR * 0.3, y - scaledR * 0.3, scaledR * 0.1,
                x, y, scaledR
            );

            if (glow > 0) {
                gradient.addColorStop(0, '#ffffff');
                gradient.addColorStop(1, '#C0C0C0');
            } else {
                gradient.addColorStop(0, '#C0C0C0');
                gradient.addColorStop(0.7, '#9E9E9E');
                gradient.addColorStop(1, '#606060');
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
    function drawBall(ctx, x, y, radius, scaleX, scaleY) {
        const bx = x * scaleX;
        const by = y * scaleY;
        const br = radius * Math.min(scaleX, scaleY);
        const pulseScale = AnimationManager.getBallPulseScale();
        const r = br * pulseScale;

        // Ball shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.ellipse(bx + 2, by + 3, r * 0.9, r * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Ball body
        const gradient = ctx.createRadialGradient(
            bx - r * 0.2, by - r * 0.3, r * 0.1,
            bx, by, r
        );
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.8, '#e0e0e0');
        gradient.addColorStop(1, '#bdbdbd');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(bx, by, r, 0, Math.PI * 2);
        ctx.fill();

        // Ball pattern (simple pentagon pattern)
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
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
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.arc(bx - r * 0.25, by - r * 0.3, r * 0.2, 0, Math.PI * 2);
        ctx.fill();
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

    return {
        setTheme,
        buildStaticField,
        drawStaticField,
        drawNails,
        drawBall,
        drawMiniPreview,
        invalidateCache,
        THEMES
    };
})();
