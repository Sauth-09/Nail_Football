/**
 * jokerManager.js - Joker (Power-Up) System Manager
 * 
 * Each player gets ONE joker per game. Three types:
 * 1. Flaming Ball  - Super fast shot, passes through goalkeeper
 * 2. Freeze Keeper - Goalkeeper stays frozen during the shot
 * 3. Destroy Nail  - Remove one nail from the field
 * 
 * State machine for joker flow:
 * idle -> selecting_nail (if destroy nail chosen) -> executed
 * idle -> executed (for flaming ball / freeze keeper)
 */

'use strict';

const JokerManager = (() => {
    // ═══════════════════════════════════════════
    // Joker Type Definitions
    // ═══════════════════════════════════════════

    /** @type {Object} Joker type metadata */
    const JOKER_TYPES = {
        flamingBall: {
            id: 'flamingBall',
            name: 'Alevli Top',
            emoji: '🔥',
            description: 'Çok hızlı atar, kaleciden geçer!',
            color: '#FF4500'
        },
        freezeGoalkeeper: {
            id: 'freezeGoalkeeper',
            name: 'Kaleci Dondur',
            emoji: '❄️',
            description: 'Kaleci bu atış boyunca donar!',
            color: '#00BCD4'
        },
        destroyNail: {
            id: 'destroyNail',
            name: 'Çivi Yok Et',
            emoji: '📌',
            description: 'Bir çiviyi seç ve yok et!',
            color: '#9C27B0'
        }
    };

    // ═══════════════════════════════════════════
    // State
    // ═══════════════════════════════════════════

    /** @type {Object} Whether each player has used their joker { 1: bool, 2: bool } */
    let jokersUsed = { 1: false, 2: false };

    /** @type {Object|null} Currently active joker { player: number, type: string } */
    let activeJoker = null;

    /** @type {boolean} Whether we're in nail selection mode */
    let nailSelectMode = false;

    /** @type {Function|null} Callback when nail is selected */
    let onNailSelectCallback = null;

    /** @type {Object|null} Stores the removed nail data for restoration { nail: {x,y}, index: number } */
    let removedNailData = null;

    // ═══════════════════════════════════════════
    // Public API
    // ═══════════════════════════════════════════

    /**
     * Returns all joker type definitions
     * @returns {Object}
     */
    function getJokerTypes() {
        return JOKER_TYPES;
    }

    /**
     * Checks if a player can use a joker
     * @param {number} player - 1 or 2
     * @returns {boolean}
     */
    function hasJokerAvailable(player) {
        return !jokersUsed[player];
    }

    /**
     * Activates a joker for a player
     * @param {number} player - 1 or 2
     * @param {string} type - Joker type key
     * @param {Object} [extraData] - Optional extra metadata for the joker
     * @returns {boolean} Whether activation was successful
     */
    function activateJoker(player, type, extraData = null) {
        if (jokersUsed[player]) {
            console.warn(`[JokerManager] Player ${player} already used their joker`);
            return false;
        }
        if (!JOKER_TYPES[type]) {
            console.warn(`[JokerManager] Unknown joker type: ${type}`);
            return false;
        }

        activeJoker = { player, type, ...(extraData || {}) };
        jokersUsed[player] = true;

        console.log(`[JokerManager] Player ${player} activated: ${JOKER_TYPES[type].name}`);
        return true;
    }

    /**
     * Gets the currently active joker (if any)
     * @returns {Object|null} { player, type } or null
     */
    function getActiveJoker() {
        return activeJoker;
    }

    /**
     * Returns shot options based on active joker (for physics engine)
     * @returns {Object} Options to pass to physics simulateShot
     */
    function getJokerShotOptions() {
        if (!activeJoker) return {};

        const options = {};
        switch (activeJoker.type) {
            case 'flamingBall':
                options.flamingBall = true;
                options.powerMultiplier = 2.5;
                options.skipGoalkeeper = true;
                break;
            case 'freezeGoalkeeper':
                options.freezeGoalkeeper = true;
                options.frozenY = activeJoker.frozenY;
                break;
        }
        return options;
    }

    /**
     * Enters nail selection mode (for destroyNail joker)
     * @param {Function} onSelect - Callback with (nailIndex) when nail is selected
     */
    function enterNailSelectMode(onSelect) {
        nailSelectMode = true;
        onNailSelectCallback = onSelect;
        console.log('[JokerManager] Nail selection mode entered');
    }

    /**
     * Selects a nail to destroy
     * @param {number} nailIndex - Index of the nail in field.nails array
     */
    function selectNail(nailIndex) {
        if (!nailSelectMode) return;

        nailSelectMode = false;
        if (onNailSelectCallback) {
            onNailSelectCallback(nailIndex);
            onNailSelectCallback = null;
        }
        console.log(`[JokerManager] Nail ${nailIndex} selected for destruction`);
    }

    /**
     * Checks if nail selection mode is active
     * @returns {boolean}
     */
    function isNailSelectMode() {
        return nailSelectMode;
    }

    /**
     * Clears the active joker (after shot is complete)
     */
    function clearActiveJoker() {
        activeJoker = null;
    }

    /**
     * Stores the removed nail data so it can be restored later
     * @param {Object} nail - The nail object { x, y }
     * @param {number} index - Original index in field.nails array
     */
    function setRemovedNail(nail, index) {
        removedNailData = { nail: { ...nail }, index };
        console.log(`[JokerManager] Removed nail stored: index=${index}, x=${nail.x}, y=${nail.y}`);
    }

    /**
     * Gets the removed nail data (if any)
     * @returns {Object|null} { nail: {x,y}, index: number } or null
     */
    function getRemovedNail() {
        return removedNailData;
    }

    /**
     * Restores the previously removed nail to the field
     * @param {Object} field - Field configuration with nails array
     * @returns {boolean} Whether restoration was successful
     */
    function restoreRemovedNail(field) {
        if (!removedNailData || !field || !field.nails) {
            return false;
        }

        // Insert nail back at its original index (or at end if index is out of bounds)
        const insertIndex = Math.min(removedNailData.index, field.nails.length);
        field.nails.splice(insertIndex, 0, removedNailData.nail);

        console.log(`[JokerManager] Nail restored at index ${insertIndex}. Total nails: ${field.nails.length}`);
        removedNailData = null;
        return true;
    }

    /**
     * Cancels nail selection mode
     */
    function cancelNailSelect() {
        if (nailSelectMode) {
            nailSelectMode = false;
            onNailSelectCallback = null;
            // Refund the joker if cancelled
            if (activeJoker) {
                jokersUsed[activeJoker.player] = false;
                activeJoker = null;
            }
            console.log('[JokerManager] Nail selection cancelled');
        }
    }

    /**
     * Resets all joker state (for new game / restart)
     */
    function resetJokers() {
        jokersUsed = { 1: false, 2: false };
        activeJoker = null;
        nailSelectMode = false;
        onNailSelectCallback = null;
        removedNailData = null;
    }

    return {
        getJokerTypes,
        hasJokerAvailable,
        activateJoker,
        getActiveJoker,
        getJokerShotOptions,
        enterNailSelectMode,
        selectNail,
        isNailSelectMode,
        clearActiveJoker,
        cancelNailSelect,
        resetJokers,
        setRemovedNail,
        getRemovedNail,
        restoreRemovedNail
    };
})();
