/**
 * inputHandler.js - Mouse + Touch Birleşik Girdi Yönetimi
 * 
 * Pointer Events API kullanarak hem mouse hem touch girdiyi yönetir.
 * Yön seçimi ve güç barı kontrolü için kullanılır.
 * Dokunmatik cihazlarda tarayıcı varsayılan davranışlarını engeller.
 */

'use strict';

const InputHandler = (() => {
    /** @type {HTMLCanvasElement|null} */
    let canvas = null;

    /** @type {Function|null} Direction change callback */
    let onDirectionChange = null;

    /** @type {Function|null} Direction confirm callback */
    let onDirectionConfirm = null;

    /** @type {Function|null} Power lock callback */
    let onPowerLock = null;

    /** @type {string} Current input phase: 'idle', 'direction', 'power', 'animating' */
    let phase = 'idle';

    /** @type {boolean} Is pointer currently down */
    let isPointerDown = false;

    /** @type {Object} Current ball position in field coords */
    let ballPos = { x: 0, y: 0 };

    /**
     * Initializes the input handler
     * @param {HTMLCanvasElement} gameCanvas
     */
    function init(gameCanvas) {
        canvas = gameCanvas;

        // Pointer Events (covers both mouse and touch)
        canvas.addEventListener('pointerdown', handlePointerDown, { passive: false });
        canvas.addEventListener('pointermove', handlePointerMove, { passive: false });
        canvas.addEventListener('pointerup', handlePointerUp, { passive: false });
        canvas.addEventListener('pointercancel', handlePointerUp, { passive: false });

        // Prevent default touch behaviors on canvas
        canvas.addEventListener('touchstart', preventDefault, { passive: false });
        canvas.addEventListener('touchmove', preventDefault, { passive: false });

        // Prevent context menu
        canvas.addEventListener('contextmenu', preventDefault);
    }

    /**
     * Prevents default event behavior
     * @param {Event} e
     */
    function preventDefault(e) {
        e.preventDefault();
    }

    /**
     * Sets the current ball position (for angle calculation)
     * @param {number} x - Field X coordinate
     * @param {number} y - Field Y coordinate
     */
    function setBallPosition(x, y) {
        ballPos.x = x;
        ballPos.y = y;
    }

    /**
     * Sets the input phase
     * @param {string} newPhase - 'idle', 'direction', 'power', 'animating'
     */
    function setPhase(newPhase) {
        phase = newPhase;
    }

    /**
     * Sets callback functions
     * @param {Object} callbacks
     * @param {Function} callbacks.onDirectionChange - Called with angle when direction changes
     * @param {Function} callbacks.onDirectionConfirm - Called with final angle when direction is locked
     * @param {Function} callbacks.onPowerLock - Called when power is locked
     */
    function setCallbacks(callbacks) {
        onDirectionChange = callbacks.onDirectionChange || null;
        onDirectionConfirm = callbacks.onDirectionConfirm || null;
        onPowerLock = callbacks.onPowerLock || null;
    }

    /**
     * Handles pointer down event
     * @param {PointerEvent} e
     */
    function handlePointerDown(e) {
        e.preventDefault();
        isPointerDown = true;

        if (phase === 'direction') {
            // Calculate angle from ball to pointer
            const fieldPos = GameRenderer.canvasToField(e.clientX, e.clientY);
            const angle = Math.atan2(fieldPos.y - ballPos.y, fieldPos.x - ballPos.x);

            if (onDirectionChange) {
                onDirectionChange(angle);
            }
        } else if (phase === 'power') {
            // Lock power on any touch/click
            if (onPowerLock) {
                onPowerLock();
            }
        }
    }

    /**
     * Handles pointer move event
     * @param {PointerEvent} e
     */
    function handlePointerMove(e) {
        e.preventDefault();

        if (phase === 'direction') {
            // Update direction based on pointer position
            const fieldPos = GameRenderer.canvasToField(e.clientX, e.clientY);
            const angle = Math.atan2(fieldPos.y - ballPos.y, fieldPos.x - ballPos.x);

            if (onDirectionChange) {
                onDirectionChange(angle);
            }
        }
    }

    /**
     * Handles pointer up event
     * @param {PointerEvent} e
     */
    function handlePointerUp(e) {
        e.preventDefault();

        if (phase === 'direction' && isPointerDown) {
            // Confirm direction
            const fieldPos = GameRenderer.canvasToField(e.clientX, e.clientY);
            const angle = Math.atan2(fieldPos.y - ballPos.y, fieldPos.x - ballPos.x);

            if (onDirectionConfirm) {
                onDirectionConfirm(angle);
            }
        }

        isPointerDown = false;
    }

    /**
     * @returns {string} Current phase
     */
    function getPhase() {
        return phase;
    }

    /**
     * Cleans up event listeners
     */
    function destroy() {
        if (!canvas) return;
        canvas.removeEventListener('pointerdown', handlePointerDown);
        canvas.removeEventListener('pointermove', handlePointerMove);
        canvas.removeEventListener('pointerup', handlePointerUp);
        canvas.removeEventListener('pointercancel', handlePointerUp);
        canvas.removeEventListener('touchstart', preventDefault);
        canvas.removeEventListener('touchmove', preventDefault);
        canvas.removeEventListener('contextmenu', preventDefault);
    }

    return {
        init,
        setBallPosition,
        setPhase,
        setCallbacks,
        getPhase,
        destroy
    };
})();
