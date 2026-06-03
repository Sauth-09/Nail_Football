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
    let goalkeeperFrozen = false;
    let goalkeeperFrozenY = 0;

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
    function setGoalkeeperState(enabled, shotStartTime = 0, frozen = false, frozenY = null) {
        goalkeeperEnabled = enabled;
        goalkeeperShotStartTime = shotStartTime;
        goalkeeperFrozen = frozen;
        goalkeeperFrozenY = frozenY;
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
            
            // SENKRONİZASYON DÜZELTMESİ:
            // Top hareket halindeyse (animasyon), görsel zamanı fizik zamanıyla senkronize et
            if (typeof PhysicsClient.isPlaying === 'function' && PhysicsClient.isPlaying()) {
                if (typeof PhysicsClient.getCurrentFrame === 'function') {
                    // Sabit zaman adımı 1/60 (ms cinsinden 1000/60)
                    t = goalkeeperShotStartTime + (PhysicsClient.getCurrentFrame() * (1000 / 60));
                }
            }

            const gkBaseY = field.fieldHeight / 2;
            // Goalkeeper positioned close to goal line (synced with physics engine)
            const gkLeftX = field.goalDepth + 12;
            const gkRightX = field.fieldWidth - field.goalDepth - 12;
            const gkWidth = 12;
            const gkHeight = (typeof UIManager !== 'undefined' ? UIManager.getSettings().goalkeeperSize : 30) || 30;

            let gkLeftY, gkRightY;
            const settings = typeof UIManager !== 'undefined' ? UIManager.getSettings() : { goalkeeperMode: 'patrol' };
            const gkMode = settings.goalkeeperMode || 'patrol';

            if (goalkeeperFrozen) {
                const frozenY = goalkeeperFrozenY !== null ? goalkeeperFrozenY : gkBaseY;
                gkLeftY = frozenY;
                gkRightY = frozenY;
            } else if (typeof PhysicsClient !== 'undefined' && PhysicsClient.isPlaying && PhysicsClient.isPlaying()) {
                const frameData = typeof PhysicsClient.getCurrentPlaybackData === 'function' ? PhysicsClient.getCurrentPlaybackData() : null;
                if (frameData && frameData.gkLeftY !== undefined && frameData.gkRightY !== undefined) {
                    gkLeftY = frameData.gkLeftY;
                    gkRightY = frameData.gkRightY;
                } else {
                    let t2 = goalkeeperShotStartTime;
                    if (typeof PhysicsClient.getCurrentFrame === 'function') {
                        t2 = goalkeeperShotStartTime + (PhysicsClient.getCurrentFrame() * (1000 / 60));
                    }
                    const patrolY = PhysicsClient.getGoalkeeperY(t2, field, gkBaseY);
                    gkLeftY = patrolY;
                    gkRightY = patrolY;
                }
            } else {
                if (gkMode === 'smart') {
                    gkLeftY = gkBaseY;
                    gkRightY = gkBaseY;
                } else {
                    const patrolY = PhysicsClient.getGoalkeeperY(Date.now(), field, gkBaseY);
                    gkLeftY = patrolY;
                    gkRightY = patrolY;
                }
            }

            const normalGkColor = gkMode === 'smart' ? '#1DDB87' : '#E0E0E0';
            const gkColor = goalkeeperFrozen ? '#80DEEA' : normalGkColor;
            drawGoalkeeper(ctx, gkLeftX, gkLeftY, gkWidth, gkHeight, gkColor);
            drawGoalkeeper(ctx, gkRightX, gkRightY, gkWidth, gkHeight, gkColor);

            // Draw freeze effect indicator when frozen
            if (goalkeeperFrozen) {
                ctx.save();
                ctx.globalAlpha = 0.4 + Math.sin(t * 0.005) * 0.2;
                ctx.strokeStyle = '#00BCD4';
                ctx.lineWidth = 2;
                const r = (gkHeight / 2 + 4) * Math.min(scaleX, scaleY);
                ctx.beginPath();
                ctx.arc(gkLeftX * scaleX, gkLeftY * scaleY, r, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(gkRightX * scaleX, gkRightY * scaleY, r, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
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

        // Layer 7.5: Fireworks
        AnimationManager.drawFireworks(ctx, 0, 0, Math.min(scaleX, scaleY));

        // Layer 8: Effects after ball (net rip, near-miss text)
        if (typeof EffectsManager !== 'undefined') {
            EffectsManager.draw(ctx, scaleX, scaleY, canvasWidth || canvas.width / (window.devicePixelRatio || 1), canvasHeight || canvas.height / (window.devicePixelRatio || 1));
        }

        // Layer 9: Stadium lights overlay
        AnimationManager.drawStadiumLights(ctx, canvasWidth || canvas.width / (window.devicePixelRatio || 1), canvasHeight || canvas.height / (window.devicePixelRatio || 1));

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
     * Draws a capsule-shaped goalkeeper or a realistic figure based on settings
     */
    function drawGoalkeeper(ctx, x, y, w, h, color) {
        const settings = typeof UIManager !== 'undefined' ? UIManager.getSettings() : { goalkeeperStyle: 'classic' };
        const style = settings.goalkeeperStyle || 'classic';

        if (style === 'realistic') {
            const isLeft = x < (field ? field.fieldWidth / 2 : 450);
            drawRealisticGoalkeeper(ctx, x, y, w, h, color, isLeft);
            return;
        }

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
     * Draws a highly detailed top-down goalkeeper figure with jersey, cap, and gloves (optimized & team-themed)
     */
    function drawRealisticGoalkeeper(ctx, x, y, w, h, color, isLeft) {
        ctx.save();

        const sX = scaleX;
        const sY = scaleY;
        const sMin = Math.min(sX, sY);

        // Direction facing the field: Left goalkeeper faces right (1), right goalkeeper faces left (-1)
        const dir = isLeft ? 1 : -1;

        // Base colors
        const skinColor = '#ffdbac'; // Skin tone
        let jerseyColor = color; // Dynamic jersey color (smart/patrol/frozen)
        let secondaryColor = '#ffffff'; // Secondary jersey color
        let gloveColor = '#ff5722'; // High visibility orange gloves
        let capColor = '#1e88e5'; // Team blue cap
        let numberColor = '#ffffff'; // Jersey number color

        // Get team information for team-compatible goalkeeper jerseys
        const team = typeof TeamManager !== 'undefined' ? TeamManager.getTeam(isLeft ? 1 : 2) : null;
        if (team && team.colors) {
            jerseyColor = team.colors[0];
            secondaryColor = team.colors[1] || '#ffffff';
            capColor = team.colors[1] || team.colors[0];
            
            // Adjust number color for readability
            const upperColor = jerseyColor.toUpperCase();
            if (upperColor === '#FFFFFF' || upperColor === '#FFED00' || upperColor === '#FFC72C') {
                numberColor = '#000000';
            }
        }

        // If frozen, make gloves, cap and jersey icy too
        const isFrozen = (color === '#80DEEA');
        if (isFrozen) {
            jerseyColor = '#80DEEA';
            secondaryColor = '#b2ebf2';
            gloveColor = '#b2ebf2';
            capColor = '#00acc1';
            numberColor = '#ffffff';
        }

        // --- 1. Draw Manual Drop Shadow (Extremely High Performance alternative to ctx.shadowColor) ---
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        const rShadow = (w / 2) * 1.35;
        const shadowX = x + dir * 2.5;
        const shadowY = y + 3.5;
        ctx.arc(shadowX * sX, (shadowY - h / 2 + rShadow) * sY, rShadow * sMin, Math.PI, 0);
        ctx.arc(shadowX * sX, (shadowY + h / 2 - rShadow) * sY, rShadow * sMin, 0, Math.PI);
        ctx.closePath();
        ctx.fill();

        // --- 2. Draw Arms & Gloves ---
        const gloveRadius = (w * 0.7) * sMin;
        
        // Top Hand & Arm
        const topGloveY = (y - h / 2 + w / 2);
        
        // Sleeve (jersey colored upper arm)
        ctx.strokeStyle = jerseyColor;
        ctx.lineWidth = w * 0.85 * sMin;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x * sX, (y - h / 5) * sY);
        ctx.lineTo(x * sX, topGloveY * sY);
        ctx.stroke();

        // Forearm skin
        ctx.strokeStyle = skinColor;
        ctx.lineWidth = w * 0.55 * sMin;
        ctx.beginPath();
        ctx.moveTo(x * sX, (topGloveY + 1) * sY);
        ctx.lineTo(x * sX, topGloveY * sY);
        ctx.stroke();

        // Top Glove (detailed)
        ctx.fillStyle = gloveColor;
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1 * sMin;
        ctx.beginPath();
        ctx.arc(x * sX, topGloveY * sY, gloveRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Fingers on Top Glove
        ctx.strokeStyle = isFrozen ? '#ffffff' : '#000000';
        ctx.lineWidth = 1 * sMin;
        for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.moveTo((x * sX) + (i * 2) * sMin, topGloveY * sY);
            ctx.lineTo((x * sX) + (dir * 5) * sMin + (i * 1.5) * sMin, (topGloveY * sY) + (i * 2) * sMin);
            ctx.stroke();
        }

        // Bottom Hand & Arm
        const bottomGloveY = (y + h / 2 - w / 2);
        
        // Sleeve
        ctx.strokeStyle = jerseyColor;
        ctx.lineWidth = w * 0.85 * sMin;
        ctx.beginPath();
        ctx.moveTo(x * sX, (y + h / 5) * sY);
        ctx.lineTo(x * sX, bottomGloveY * sY);
        ctx.stroke();

        // Forearm skin
        ctx.strokeStyle = skinColor;
        ctx.lineWidth = w * 0.55 * sMin;
        ctx.beginPath();
        ctx.moveTo(x * sX, (bottomGloveY - 1) * sY);
        ctx.lineTo(x * sX, bottomGloveY * sY);
        ctx.stroke();

        // Bottom Glove (detailed)
        ctx.fillStyle = gloveColor;
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1 * sMin;
        ctx.beginPath();
        ctx.arc(x * sX, bottomGloveY * sY, gloveRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Fingers on Bottom Glove
        for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.moveTo((x * sX) + (i * 2) * sMin, bottomGloveY * sY);
            ctx.lineTo((x * sX) + (dir * 5) * sMin + (i * 1.5) * sMin, (bottomGloveY * sY) + (i * 2) * sMin);
            ctx.stroke();
        }

        // --- 3. Draw Torso (Jersey & Shorts) ---
        // Draw Shorts/Pants base
        ctx.fillStyle = '#222222'; // Black goalie shorts
        const shortsW = w * 1.25;
        const shortsH = h * 0.35;
        ctx.beginPath();
        ctx.roundRect((x - shortsW / 2) * sX, (y - shortsH / 2) * sY, shortsW * sX, shortsH * sY, 3 * sMin);
        ctx.fill();
        ctx.stroke();

        // Draw Jersey torso
        ctx.fillStyle = jerseyColor;
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1.5 * sMin;
        const torsoW = w * 1.5;
        const torsoH = h * 0.45;
        const torsoX = x - torsoW / 2;
        const torsoY = y - torsoH / 2;
        ctx.beginPath();
        ctx.roundRect(torsoX * sX, torsoY * sY, torsoW * sX, torsoH * sY, 5 * sMin);
        ctx.fill();
        ctx.stroke();

        // Draw details on jersey (e.g. horizontal design stripe)
        ctx.fillStyle = isFrozen ? 'rgba(255, 255, 255, 0.3)' : secondaryColor;
        ctx.beginPath();
        ctx.rect((x - torsoW / 2) * sX, (y - torsoH / 6) * sY, torsoW * sX, (torsoH / 3) * sY);
        ctx.fill();

        // Draw Jersey Number '1' on the back (facing away from the field)
        ctx.fillStyle = numberColor;
        ctx.font = `bold ${8 * sMin}px 'Outfit', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const numX = x - (dir * 4.5);
        ctx.fillText('1', numX * sX, y * sY);

        // --- 4. Draw Head & Cap ---
        const headRadius = (w * 0.6) * sMin;
        
        // Head Skin
        ctx.fillStyle = skinColor;
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1 * sMin;
        ctx.beginPath();
        ctx.arc(x * sX, y * sY, headRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Cap Dome (covers back of the head)
        ctx.fillStyle = capColor;
        ctx.beginPath();
        // Draw dome facing opposite of direction dir
        const startAngle = dir === 1 ? Math.PI * 0.5 : Math.PI * 1.5;
        const endAngle = dir === 1 ? Math.PI * 1.5 : Math.PI * 0.5;
        ctx.arc(x * sX, y * sY, headRadius, startAngle, endAngle);
        ctx.fill();
        ctx.stroke();

        // Cap Visor (pointing in direction dir)
        ctx.fillStyle = capColor;
        ctx.beginPath();
        ctx.moveTo((x - dir * 1) * sX, (y - headRadius * 0.6) * sY);
        ctx.lineTo((x + dir * headRadius * 1.45) * sX, y * sY);
        ctx.lineTo((x - dir * 1) * sX, (y + headRadius * 0.6) * sY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Visor line
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1 * sMin;
        ctx.beginPath();
        ctx.moveTo((x - dir * 1) * sX, (y - headRadius * 0.6) * sY);
        ctx.lineTo((x - dir * 1) * sX, (y + headRadius * 0.6) * sY);
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
