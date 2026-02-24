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

    let goalkeeperEnabled = true;
    let goalkeeperShotStartTime = 0;

    let canvasWidth = 0, canvasHeight = 0;

    /**
     * Initializes the renderer
     * @param {HTMLCanvasElement} gameCanvas
     */
    function init(gameCanvas) {
        canvas = gameCanvas;
        ctx = canvas.getContext('2d');
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Use ResizeObserver to catch layout changes when screen becomes visible
        if (window.ResizeObserver) {
            const container = document.getElementById('canvas-container');
            if (container) {
                const ro = new ResizeObserver(() => {
                    if (field) resizeCanvas();
                });
                ro.observe(container);
            }
        }
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

        if (containerAspect > fieldAspect) {
            // Container is wider than field
            canvasHeight = Math.floor(containerHeight);
            canvasWidth = Math.floor(canvasHeight * fieldAspect);
        } else {
            // Container is taller than field
            canvasWidth = Math.floor(containerWidth);
            canvasHeight = Math.floor(canvasWidth / fieldAspect);
        }

        const dpr = window.devicePixelRatio || 1;

        // Set logical CSS dimensions for layout
        canvas.style.width = canvasWidth + 'px';
        canvas.style.height = canvasHeight + 'px';

        // Set physical resolution (rounded to avoid sub-pixel blur)
        canvas.width = Math.floor(canvasWidth * dpr);
        canvas.height = Math.floor(canvasHeight * dpr);

        // Reset scale before applying new one to prevent stacking
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);

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
     * Updates goalkeeper configuration for rendering
     */
    function setGoalkeeperState(enabled, shotStartTime = 0) {
        goalkeeperEnabled = enabled;
        goalkeeperShotStartTime = shotStartTime;
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
        FieldRenderer.drawStaticField(ctx, canvasWidth || canvas.width / (window.devicePixelRatio || 1), canvasHeight || canvas.height / (window.devicePixelRatio || 1));

        // Layer 4: Nails
        FieldRenderer.drawNails(ctx, field, scaleX, scaleY);

        // Layer 4.5: Goalkeepers
        if (goalkeeperEnabled && typeof PhysicsClient !== 'undefined' && PhysicsClient.getGoalkeeperY) {
            let t = Date.now();

            const gkBaseY = field.fieldHeight / 2;
            const gkLeftX = 70;
            const gkRightX = field.fieldWidth - 70;
            const gkWidth = 12;
            const gkHeight = 40;

            const currentY = PhysicsClient.getGoalkeeperY(t, field, gkBaseY);
            drawGoalkeeper(ctx, gkLeftX, currentY, gkWidth, gkHeight, '#E0E0E0'); // Metallic silver
            drawGoalkeeper(ctx, gkRightX, currentY, gkWidth, gkHeight, '#E0E0E0');
        }

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
            EffectsManager.draw(ctx, scaleX, scaleY, canvasWidth || canvas.width / (window.devicePixelRatio || 1), canvasHeight || canvas.height / (window.devicePixelRatio || 1));
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

        let arrowLength = 110; // fallback
        if (typeof UIManager !== 'undefined') {
            const settings = UIManager.getSettings();
            if (settings && settings.arrowLength) arrowLength = settings.arrowLength;
        }

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
     * Draws a capsule-shaped goalkeeper
     */
    function drawGoalkeeper(ctx, x, y, w, h, color) {
        ctx.save();
        ctx.fillStyle = color;
        // Draw capsule
        ctx.beginPath();
        const r = w / 2;
        ctx.arc(x * scaleX, (y - h / 2 + r) * scaleY, r * Math.min(scaleX, scaleY), Math.PI, 0);
        ctx.arc(x * scaleX, (y + h / 2 - r) * scaleY, r * Math.min(scaleX, scaleY), 0, Math.PI);
        ctx.closePath();
        ctx.fill();

        // Add metallic gradient
        const grad = ctx.createLinearGradient((x - r) * scaleX, 0, (x + r) * scaleX, 0);
        grad.addColorStop(0, 'rgba(255,255,255,0.8)');
        grad.addColorStop(0.5, 'rgba(0,0,0,0.1)');
        grad.addColorStop(1, 'rgba(255,255,255,0.4)');
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.restore();
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
        setGoalkeeperState,
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
