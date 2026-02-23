/**
 * gameRenderer.js - Canvas Çizim Motoru
 * 
 * Tüm çizim katmanlarını koordine eder.
 * RequestAnimationFrame tabanlı render döngüsü.
 * Responsive canvas boyutlandırma.
 */

'use strict';

const GameRenderer = (() => {
    /** @type {HTMLCanvasElement} */
    let canvas = null;

    /** @type {CanvasRenderingContext2D} */
    let ctx = null;

    /** @type {Object} Field config */
    let field = null;

    /** @type {number} Scale factors */
    let scaleX = 1, scaleY = 1;

    /** @type {number} Canvas offset for centering */
    let offsetX = 0, offsetY = 0;

    /** @type {Object} Current ball position */
    let ballPosition = { x: 0, y: 0 };

    /** @type {Object|null} Shot direction arrow */
    let directionArrow = null; // { angle: number }

    /** @type {boolean} Whether the field has been built */
    let fieldBuilt = false;

    /** @type {number} Current player (1 or 2) */
    let currentPlayer = 1;

    /** Player colors */
    const PLAYER_COLORS = { 1: '#2196F3', 2: '#F44336' };

    /**
     * Initializes the renderer
     * @param {HTMLCanvasElement} gameCanvas
     */
    function init(gameCanvas) {
        canvas = gameCanvas;
        ctx = canvas.getContext('2d');
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
    }

    /**
     * Resizes the canvas to fit the container
     */
    function resizeCanvas() {
        const container = document.getElementById('canvas-container');
        if (!container || !field) return;

        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const fieldAspect = field.fieldWidth / field.fieldHeight;
        const containerAspect = containerWidth / containerHeight;

        let canvasWidth, canvasHeight;

        if (containerAspect > fieldAspect) {
            // Container is wider than field
            canvasHeight = containerHeight;
            canvasWidth = canvasHeight * fieldAspect;
        } else {
            // Container is taller than field
            canvasWidth = containerWidth;
            canvasHeight = canvasWidth / fieldAspect;
        }

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        scaleX = canvasWidth / field.fieldWidth;
        scaleY = canvasHeight / field.fieldHeight;

        // Rebuild static field cache
        if (field) {
            FieldRenderer.buildStaticField(field, canvasWidth, canvasHeight);
            fieldBuilt = true;
        }
    }

    /**
     * Sets the current field
     * @param {Object} fieldConfig
     */
    function setField(fieldConfig) {
        field = fieldConfig;
        ballPosition = { ...field.ballStartPosition };
        directionArrow = null;
        fieldBuilt = false;
        resizeCanvas();
    }

    /**
     * Sets the ball position
     * @param {number} x
     * @param {number} y
     */
    function setBallPosition(x, y) {
        ballPosition.x = x;
        ballPosition.y = y;
    }

    /**
     * Sets the direction arrow
     * @param {number|null} angle - Angle in radians, or null to hide
     */
    function setDirectionArrow(angle) {
        directionArrow = angle !== null ? { angle } : null;
    }

    /**
     * Gets canvas coordinates from field coordinates
     * @param {number} fieldX
     * @param {number} fieldY
     * @returns {{x: number, y: number}}
     */
    function fieldToCanvas(fieldX, fieldY) {
        return {
            x: fieldX * scaleX,
            y: fieldY * scaleY
        };
    }

    /**
     * Gets field coordinates from canvas/screen coordinates
     * @param {number} screenX
     * @param {number} screenY
     * @returns {{x: number, y: number}}
     */
    function canvasToField(screenX, screenY) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (screenX - rect.left) / scaleX,
            y: (screenY - rect.top) / scaleY
        };
    }

    /**
     * Main render function - draws a single frame
     */
    function render() {
        if (!ctx || !field || !fieldBuilt) return;

        const shakeOffset = AnimationManager.getShakeOffset();

        ctx.save();
        ctx.translate(shakeOffset.x, shakeOffset.y);

        // Layer 1-3: Static field (from cache)
        FieldRenderer.drawStaticField(ctx);

        // Layer 4: Nails
        FieldRenderer.drawNails(ctx, field, scaleX, scaleY);

        // Layer 5a: Effects before ball (trail, glow)
        if (typeof EffectsManager !== 'undefined') {
            EffectsManager.drawBeforeBall(ctx, ballPosition.x, ballPosition.y, field.ballRadius, scaleX, scaleY);
        }

        // Layer 5b: Ball (with player color)
        const ballColor = PLAYER_COLORS[currentPlayer] || '#ffffff';
        FieldRenderer.drawBall(ctx, ballPosition.x, ballPosition.y, field.ballRadius, scaleX, scaleY, ballColor);

        // Layer 6: UI Overlay
        if (directionArrow) {
            drawDirectionArrow(ctx, directionArrow.angle);
        }

        // Layer 7: Particles
        AnimationManager.drawParticles(ctx, 0, 0, Math.min(scaleX, scaleY));

        // Layer 8: Effects after ball (net rip, near-miss text)
        if (typeof EffectsManager !== 'undefined') {
            EffectsManager.draw(ctx, scaleX, scaleY, canvas.width, canvas.height);
        }

        ctx.restore();
    }

    /**
     * Draws the direction arrow (dotted line with animated flow)
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} angle - Direction angle in radians
     */
    function drawDirectionArrow(ctx, angle) {
        const bx = ballPosition.x * scaleX;
        const by = ballPosition.y * scaleY;
        const arrowLength = 120;

        const ex = bx + Math.cos(angle) * arrowLength;
        const ey = by + Math.sin(angle) * arrowLength;

        // Animated dotted line
        const time = Date.now() / 200;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 8]);
        ctx.lineDashOffset = -time;

        // Gradient effect (green to red)
        const gradient = ctx.createLinearGradient(bx, by, ex, ey);
        gradient.addColorStop(0, '#4CAF50');
        gradient.addColorStop(1, '#F44336');
        ctx.strokeStyle = gradient;

        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        ctx.setLineDash([]);

        // Arrow head
        const headSize = 10;
        const headAngle = Math.PI / 6;
        ctx.fillStyle = '#F44336';
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(
            ex - headSize * Math.cos(angle - headAngle),
            ey - headSize * Math.sin(angle - headAngle)
        );
        ctx.lineTo(
            ex - headSize * Math.cos(angle + headAngle),
            ey - headSize * Math.sin(angle + headAngle)
        );
        ctx.closePath();
        ctx.fill();
    }

    /**
     * Gets the canvas bounding rect
     * @returns {DOMRect}
     */
    function getCanvasRect() {
        return canvas ? canvas.getBoundingClientRect() : new DOMRect();
    }

    /**
     * @returns {{scaleX: number, scaleY: number}}
     */
    function getScale() {
        return { scaleX, scaleY };
    }

    /**
     * @returns {Object} Current field config
     */
    function getField() {
        return field;
    }

    return {
        init,
        setField,
        setBallPosition,
        setDirectionArrow,
        setCurrentPlayer: (p) => { currentPlayer = p; },
        fieldToCanvas,
        canvasToField,
        render,
        getCanvasRect,
        getScale,
        getField,
        resizeCanvas
    };
})();
